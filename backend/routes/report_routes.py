"""
report_routes.py — Clinic-level disease reports with role-based access control.
- Admin / hospital_staff: can report for any clinic
- clinic_staff: can only report for their assigned_clinic
- public_health_officer: read-only, cannot submit
"""

from datetime import datetime, timezone, date
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, validator
from sqlalchemy.orm import Session
from typing import Optional

from database import get_db
from models import Report
from auth import get_current_user, require_reporter
from utils import aggregate_area_zones, refresh_area_alerts, log_activity

router = APIRouter(tags=["Reports"])


# ── Schemas ───────────────────────────────────────────────────────────────────

# Maximum realistic limits per single report submission
MAX_CASE_COUNT  = 100_000
MAX_DEATH_COUNT = 500


def _validate_report_date(v: Optional[str]) -> Optional[str]:
    """Reject dates in the future."""
    if not v:
        return v
    try:
        parsed = datetime.fromisoformat(v).date() if "T" in v else date.fromisoformat(v)
    except (ValueError, TypeError):
        raise ValueError("Invalid date format. Use YYYY-MM-DD.")
    if parsed > date.today():
        raise ValueError("Report date cannot be in the future.")
    return v


class CaseReportRequest(BaseModel):
    area_id:      str
    area_name:    str
    clinic_name:  str = ""
    latitude:     float = Field(..., ge=-90,  le=90)
    longitude:    float = Field(..., ge=-180, le=180)
    disease_name: str
    case_count:   int  = Field(0, ge=0, le=MAX_CASE_COUNT)
    date:         Optional[str] = None

    @validator("date")
    def check_date(cls, v):
        return _validate_report_date(v)

    @validator("case_count")
    def check_case_count(cls, v):
        if v > MAX_CASE_COUNT:
            raise ValueError(f"Case count cannot exceed {MAX_CASE_COUNT:,} per report.")
        return v


class DeathReportRequest(BaseModel):
    area_id:      str
    area_name:    str
    clinic_name:  str = ""
    latitude:     float = Field(..., ge=-90,  le=90)
    longitude:    float = Field(..., ge=-180, le=180)
    disease_name: str
    death_count:  int  = Field(0, ge=0, le=MAX_DEATH_COUNT)
    date:         Optional[str] = None

    @validator("date")
    def check_date(cls, v):
        return _validate_report_date(v)

    @validator("death_count")
    def check_death_count(cls, v):
        if v > MAX_DEATH_COUNT:
            raise ValueError(f"Death count cannot exceed {MAX_DEATH_COUNT:,} per report.")
        return v


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def _report_day(ts: str) -> str:
    """Normalize report timestamp to calendar day for deduplication."""
    if not ts:
        return date.today().isoformat()
    try:
        if "T" in ts:
            return datetime.fromisoformat(ts.replace("Z", "+00:00")).date().isoformat()
        return date.fromisoformat(ts[:10]).isoformat()
    except (ValueError, TypeError):
        return date.today().isoformat()


def _area_zone_for_report(area_id: str, all_reports) -> dict:
    area_map = aggregate_area_zones(all_reports)
    area = area_map.get(area_id)
    if not area:
        return {"zone": "GREEN", "risk_score": 0, "cases_per_100k": 0}
    return {
        "zone": area["zone"],
        "risk_score": area.get("risk_score", 0),
        "cases_per_100k": area.get("cases_per_100k", 0),
    }


def _check_clinic_permission(current_user: dict, clinic_name: str):
    """Clinic staff can only report for their assigned clinic."""
    if current_user["role"] == "clinic_staff":
        assigned = current_user.get("assigned_clinic", "")
        if assigned and clinic_name and clinic_name != assigned:
            raise HTTPException(
                status_code=403,
                detail=f"You can only submit reports for your assigned clinic: {assigned}"
            )


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/report_case", status_code=status.HTTP_201_CREATED)
async def report_case(
    body: CaseReportRequest,
    current_user: dict = Depends(require_reporter),
    db: Session = Depends(get_db),
):
    _check_clinic_permission(current_user, body.clinic_name)

    ts = body.date or _now_iso()
    day = _report_day(ts)
    clinic = body.clinic_name or body.area_name

    existing = (
        db.query(Report)
        .filter(
            Report.area_id == body.area_id,
            Report.clinic_name == clinic,
            Report.disease_name == body.disease_name,
        )
        .all()
    )
    report = None
    merged = False
    for row in existing:
        if _report_day(row.timestamp) == day:
            row.case_count += body.case_count
            row.latitude = body.latitude
            row.longitude = body.longitude
            row.timestamp = ts
            report = row
            merged = True
            break

    if report is None:
        report = Report(
            area_id=body.area_id,
            area_name=body.area_name,
            clinic_name=clinic,
            latitude=body.latitude,
            longitude=body.longitude,
            disease_name=body.disease_name,
            case_count=body.case_count,
            death_count=0,
            timestamp=ts,
        )
        db.add(report)

    db.commit()
    db.refresh(report)

    all_reports = db.query(Report).all()
    area_zone = _area_zone_for_report(body.area_id, all_reports)
    refresh_area_alerts(db)

    clinic_label = body.clinic_name or body.area_name
    log_activity(current_user["username"], f"SUBMITTED CASE REPORT: {body.disease_name} at {clinic_label}", db)

    return {
        "id": report.id,
        "message": "Case report submitted",
        "zone": area_zone["zone"],
        "risk_score": area_zone["risk_score"],
        "cases_per_100k": area_zone["cases_per_100k"],
        "merged": merged,
    }


@router.post("/report_death", status_code=status.HTTP_201_CREATED)
async def report_death(
    body: DeathReportRequest,
    current_user: dict = Depends(require_reporter),
    db: Session = Depends(get_db),
):
    _check_clinic_permission(current_user, body.clinic_name)

    ts = body.date or _now_iso()
    day = _report_day(ts)
    clinic = body.clinic_name or body.area_name

    existing_reports = (
        db.query(Report)
        .filter(
            Report.area_id      == body.area_id,
            Report.clinic_name  == clinic,
            Report.disease_name == body.disease_name,
        )
        .all()
    )

    total_cases = sum(r.case_count for r in existing_reports)
    total_deaths = sum(r.death_count for r in existing_reports)

    if total_deaths + body.death_count > total_cases:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid report: Cumulative deaths ({total_deaths + body.death_count}) cannot exceed cumulative cases ({total_cases}) for {body.disease_name}."
        )

    report = None
    merged = False
    for row in existing_reports:
        if _report_day(row.timestamp) == day:
            row.death_count += body.death_count
            row.latitude = body.latitude
            row.longitude = body.longitude
            row.timestamp = ts
            report = row
            merged = True
            break

    if report is None:
        report = Report(
            area_id      = body.area_id,
            area_name    = body.area_name,
            clinic_name  = clinic,
            latitude     = body.latitude,
            longitude    = body.longitude,
            disease_name = body.disease_name,
            case_count   = 0,
            death_count  = body.death_count,
            timestamp    = ts,
        )
        db.add(report)

    db.commit()
    db.refresh(report)

    all_reports = db.query(Report).all()
    area_zone = _area_zone_for_report(body.area_id, all_reports)
    refresh_area_alerts(db)

    log_activity(current_user["username"], f"SUBMITTED DEATH REPORT: {body.disease_name} at {clinic}", db)

    return {
        "id": report.id,
        "message": "Death report submitted",
        "zone": area_zone["zone"],
        "risk_score": area_zone["risk_score"],
        "cases_per_100k": area_zone["cases_per_100k"],
        "merged": merged,
    }


@router.get("/reports")
async def get_reports(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    log_activity(current_user["username"], "VIEWED REPORTS", db)
    q = db.query(Report)

    # Clinic staff: filter to their clinic only
    if current_user["role"] == "clinic_staff" and current_user.get("assigned_clinic"):
        q = q.filter(Report.clinic_name == current_user["assigned_clinic"])
    # Hospital staff: filter to their area
    elif current_user["role"] == "hospital_staff" and current_user.get("assigned_area"):
        q = q.filter(Report.area_name == current_user["assigned_area"])

    reports = q.order_by(Report.id.desc()).all()
    return [
        {
            "id":           r.id,
            "area_id":      r.area_id,
            "area_name":    r.area_name,
            "clinic_name":  r.clinic_name,
            "latitude":     r.latitude,
            "longitude":    r.longitude,
            "disease_name": r.disease_name,
            "case_count":   r.case_count,
            "death_count":  r.death_count,
            "timestamp":    r.timestamp,
        }
        for r in reports
    ]
