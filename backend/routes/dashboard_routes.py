"""
dashboard_routes.py — Area-aggregated stats, zone map data, and forecast endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta, timezone
from typing import Optional
import numpy as np

from database import get_db
from models import Report, Alert
from auth import get_current_user
from utils import aggregate_area_zones, log_activity

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


# ── /dashboard/stats ──────────────────────────────────────────────────────────

@router.get("/stats")
async def get_stats(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    log_activity(current_user["username"], "VIEWED DASHBOARD", db)

    reports      = db.query(Report).all()
    total_cases  = sum(r.case_count  for r in reports)
    total_deaths = sum(r.death_count for r in reports)

    area_data    = aggregate_area_zones(reports)
    zone_counts  = {"RED": 0, "YELLOW": 0, "GREEN": 0}
    for a in area_data.values():
        zone_counts[a["zone"]] += 1

    active_alerts = db.query(Alert).filter(Alert.status == "active").count()

    affected_areas = {a["area_name"]: a["clinic_count"] for a in area_data.values()}

    return {
        "total_cases":    total_cases,
        "total_deaths":   total_deaths,
        "active_cases":   max(0, total_cases - total_deaths),
        "active_alerts":  active_alerts,
        "red_zones":      zone_counts["RED"],
        "yellow_zones":   zone_counts["YELLOW"],
        "green_zones":    zone_counts["GREEN"],
        "total_reports":  len(reports),
        "total_areas":    len(area_data),
        "affected_areas": affected_areas,
        "total_clinics":  len({r.clinic_name for r in reports if r.clinic_name}),
    }


# ── /dashboard/zones  (area-level, one marker per area) ──────────────────────

@router.get("/zones")
async def get_zones(
    area:    Optional[str] = Query(None, description="Filter by area name"),
    disease: Optional[str] = Query(None, description="Filter by disease name"),
    zone:    Optional[str] = Query(None, description="Filter by zone: RED|YELLOW|GREEN"),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns ONE entry per Hyderabad area with aggregated zone, clinic list, etc.
    Supports filters: area, disease, zone.
    """
    reports  = db.query(Report).all()
    area_map = aggregate_area_zones(reports)

    results = []
    for a in area_map.values():
        # Apply filters
        if area    and area.lower()    not in a["area_name"].lower():    continue
        if disease and disease.lower() not in [d.lower() for d in a["diseases"]]: continue
        if zone    and zone.upper()    != a["zone"]:                     continue

        # Nearby outbreaks: other RED/YELLOW areas
        nearby_outbreaks = [
            other["area_name"]
            for other in area_map.values()
            if other["area_id"] != a["area_id"] and other["zone"] in ("RED", "YELLOW")
        ][:3]

        entry = dict(a)
        entry["nearby_outbreaks"] = nearby_outbreaks
        results.append(entry)

    return results


# ── /dashboard/areas ─────────────────────────────────────────────────────────

@router.get("/areas")
async def get_area_summary(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    reports  = db.query(Report).all()
    area_map = aggregate_area_zones(reports)

    result = sorted(
        area_map.values(),
        key=lambda a: ["RED", "YELLOW", "GREEN"].index(a["zone"])
    )
    return result


# ── /dashboard/forecast/{disease_name} ────────────────────────────────────────

@router.get("/forecast/{disease_name}")
async def get_forecast(
    disease_name: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from sklearn.linear_model import LinearRegression

    log_activity(current_user["username"], f"GENERATED FORECAST: {disease_name}", db)

    reports = (
        db.query(Report)
        .filter(Report.disease_name.ilike(f"%{disease_name}%"))
        .all()
    )
    if not reports:
        raise HTTPException(status_code=404, detail=f"No data found for disease: {disease_name}")

    today    = datetime.now(timezone.utc).date()
    base_day = today - timedelta(days=13)
    day_map  = {base_day + timedelta(days=i): 0 for i in range(14)}

    for r in reports:
        try:
            ts   = datetime.fromisoformat(r.timestamp.replace("Z", "+00:00"))
            date = ts.date()
            if date in day_map:
                day_map[date] += r.case_count
        except Exception:
            pass

    values = list(day_map.values())
    if all(v == 0 for v in values):
        raise HTTPException(
            status_code=404,
            detail=(
                f"Insufficient case history for {disease_name} in the last 14 days. "
                "Submit clinic reports with dates in that window to generate a forecast."
            ),
        )

    dates  = sorted(day_map.keys())
    labels = [d.strftime("%b %d") for d in dates]

    X = np.arange(len(values)).reshape(-1, 1)
    y = np.array(values)

    model = LinearRegression()
    model.fit(X, y)

    future_X        = np.arange(len(values), len(values) + 7).reshape(-1, 1)
    forecast_vals   = np.maximum(0, model.predict(future_X)).astype(int).tolist()
    future_dates    = [today + timedelta(days=i + 1) for i in range(7)]
    forecast_labels = [d.strftime("%b %d") for d in future_dates]

    return {
        "disease_name":      disease_name,
        "historical_labels": labels,
        "historical_data":   values,
        "forecast_labels":   forecast_labels,
        "forecast_data":     forecast_vals,
        "model":             "LinearRegression",
        "r2_score":          round(float(model.score(X, y)), 4),
        "clinic_count":      len({r.clinic_name for r in reports}),
    }
