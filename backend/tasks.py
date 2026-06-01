import asyncio
from datetime import datetime, timezone
from database import SessionLocal
from models import AccessRequest, User
from utils import log_activity

async def cleanup_expired_records():
    """
    Scans the database and cleans up expired access requests and password setup tokens.
    """
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        
        # 1. Clean up expired verification tokens (AccessRequest)
        expired_requests = db.query(AccessRequest).filter(
            AccessRequest.status == "pending_verification",
            AccessRequest.verification_token.isnot(None),
            AccessRequest.verification_expires.isnot(None)
        ).all()
        
        request_count = 0
        for req in expired_requests:
            try:
                expires = datetime.fromisoformat(req.verification_expires)
                if expires.tzinfo is None:
                    expires = expires.replace(tzinfo=timezone.utc)
                if now > expires:
                    req.status = "expired"
                    req.verification_token = None
                    req.verification_expires = None
                    request_count += 1
            except Exception as e:
                print(f"[Cleanup Daemon] Error checking expiry of request #{req.id}: {e}")
                
        # 2. Clean up expired password setup tokens (User)
        expired_users = db.query(User).filter(
            User.password_setup_token.isnot(None),
            User.password_setup_expires.isnot(None)
        ).all()
        
        user_count = 0
        for user in expired_users:
            try:
                expires = datetime.fromisoformat(user.password_setup_expires)
                if expires.tzinfo is None:
                    expires = expires.replace(tzinfo=timezone.utc)
                if now > expires:
                    user.password_setup_token = None
                    user.password_setup_expires = None
                    user_count += 1
            except Exception as e:
                print(f"[Cleanup Daemon] Error checking expiry of user {user.username}: {e}")
                
        if request_count > 0 or user_count > 0:
            db.commit()
            print(f"[Cleanup Daemon] Cleaned up {request_count} expired verification requests and {user_count} expired setup tokens.")
            log_activity("system", f"CLEANUP_EXPIRED_RECORDS: requests={request_count} setup_tokens={user_count}", db)
            
    except Exception as e:
        print(f"[Cleanup Daemon] Error running cleanup: {e}")
    finally:
        db.close()

async def start_cleanup_task(interval_seconds: int = 600):
    """
    Infinite loop running cleanup periodically. Default interval is 10 minutes.
    """
    print("[Cleanup Daemon] Starting periodic expired records cleanup daemon...")
    while True:
        await cleanup_expired_records()
        await asyncio.sleep(interval_seconds)
