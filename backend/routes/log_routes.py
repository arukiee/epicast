"""
log_routes.py — Activity log retrieval (admin only)
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models import ActivityLog
from auth import require_admin
from utils import log_activity

router = APIRouter(tags=["Logs"])


@router.get("/logs")
async def get_logs(
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Return all activity logs — admin-only endpoint."""
    log_activity(current_user["username"], "VIEWED ACTIVITY LOGS", db)
    logs = db.query(ActivityLog).order_by(ActivityLog.id.desc()).limit(500).all()
    return [
        {
            "id":        lg.id,
            "username":  lg.username,
            "action":    lg.action,
            "timestamp": lg.timestamp,
        }
        for lg in logs
    ]
