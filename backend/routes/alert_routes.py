"""
alert_routes.py — Alerts derived exclusively from reports.

Data flow: Reports → refresh_area_alerts() → alerts table → this API.

Endpoints:
  GET  /dashboard/alerts          — all alerts (sorted by risk level, then timestamp)
  POST /alerts/{id}/acknowledge   — mark alert acknowledged
  POST /alerts/sync               — admin: force re-derive all alerts from reports
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import Alert
from auth import get_current_user, require_admin, require_roles
from utils import log_activity, _now, refresh_area_alerts

router = APIRouter(tags=["Alerts"])

RISK_ORDER = {"RED": 0, "YELLOW": 1}


def _fmt(a: Alert) -> dict:
    return {
        "id":               a.id,
        "area_id":          a.area_id,
        "area_name":        a.area_name,
        "disease_name":     a.disease_name,
        "message":          a.message,
        "clinics_involved": a.clinics_involved,
        "affected_clinics": a.affected_clinics.split(",") if a.affected_clinics else [],
        "risk_level":       a.risk_level,
        "risk_score":       getattr(a, "risk_score", None),
        "status":           a.status,
        "timestamp":        a.timestamp,
    }


@router.get("/dashboard/alerts")
async def get_alerts(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns alerts sorted by severity (RED first) then most-recent timestamp.
    All alerts are derived from aggregated clinic reports — no independent data.
    """
    alerts = db.query(Alert).all()
    alerts.sort(
        key=lambda a: (RISK_ORDER.get(a.risk_level, 2), -(a.id or 0))
    )
    return [_fmt(a) for a in alerts]


@router.post("/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(
    alert_id: int,
    current_user: dict = Depends(
        require_roles("admin", "hospital_staff", "public_health_officer", "analyst")
    ),
    db: Session = Depends(get_db),
):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.status = "acknowledged"
    db.commit()

    log_activity(
        current_user["username"],
        f"ACKNOWLEDGED ALERT #{alert_id} — {alert.disease_name} in {alert.area_name}",
        db,
    )
    return {"message": f"Alert #{alert_id} acknowledged"}


@router.post("/alerts/sync")
async def sync_alerts_from_reports(
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Admin-only: force a full re-derivation of all alerts from current reports.
    Deletes stale alerts, creates/updates cluster alerts.
    """
    refresh_area_alerts(db)
    active_count = db.query(Alert).filter(Alert.status == "active").count()
    log_activity(current_user["username"], f"SYNCED ALERTS FROM REPORTS — {active_count} active", db)
    return {"message": "Alert sync complete", "active_alerts": active_count}
