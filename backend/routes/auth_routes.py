"""
auth_routes.py — Login, logout, refresh, role previews, and demo access.
"""

import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from models import User, DeviceSession, RefreshToken, AccessRequest
from auth import (
    hash_password, verify_password, hash_token, verify_token,
    create_access_token, create_refresh_token,
    REFRESH_TOKEN_EXPIRE_DAYS, COOKIE_SECURE,
    ROLES, get_current_user, require_admin, enforce_rate_limit,
)
from utils import get_client_ip, get_device_fingerprint, log_activity, _now
from email_service import (
    send_verification_email,
    send_password_reset_email,
    _delivery_user_message,
)
from token_utils import (
    store_token,
    find_access_request_by_verification_token,
    find_user_by_setup_token,
    find_user_by_reset_token,
)
from email_validation import check_email_deliverability, require_deliverable_email

router = APIRouter(tags=["Authentication"])


def _app_public_url(request: Request) -> str:
    """Base URL for links in transactional email (verify, reset password)."""
    # 1. First, check the incoming request origin or referer (representing the active browser session).
    # If the user is browsing on a public domain, prioritize it to dynamically adapt to deployment.
    header = request.headers.get("origin") or request.headers.get("referer") or ""
    if header and "://" in header:
        parts = header.split("/")
        origin_url = "/".join(parts[:3]).rstrip("/")
        if "localhost" not in origin_url and "127.0.0.1" not in origin_url:
            return origin_url

    # 2. Fall back to configured environment variable
    configured = os.getenv("APP_PUBLIC_URL", "").strip().rstrip("/")
    if configured:
        return configured

    # 3. Fall back to browser origin (even if it's localhost)
    if header and "://" in header:
        parts = header.split("/")
        return "/".join(parts[:3]).rstrip("/")

    # 4. Ultimate default
    return "http://localhost:5173"



def _normalize_email(email: str) -> str:
    return (email or "").strip().lower()


def _merge_deliverability(result: dict, deliverability: dict | None) -> dict:
    """Attach DNS/MX validation details from email-validator (not regex-only)."""
    if not deliverability:
        return result
    result["syntax_valid"] = deliverability.get("syntax_valid", False)
    result["mx_found"] = deliverability.get("mx_found", False)
    result["check_method"] = deliverability.get("check_method", "dns_mx")
    if deliverability.get("normalized"):
        result["normalized_email"] = deliverability["normalized"]
    if deliverability.get("domain"):
        result["domain"] = deliverability["domain"]
    if deliverability.get("mx_hosts"):
        result["mx_hosts"] = deliverability["mx_hosts"]
    return result


def _check_access_request_email(email: str, db: Session) -> dict:
    """Return whether a work email can be used for a new access request."""
    normalized = _normalize_email(email)
    if not normalized or "@" not in normalized:
        return {
            "available": False,
            "deliverable": False,
            "reason": "invalid",
            "message": "Please enter a valid work email address.",
        }

    user = db.query(User).filter(func.lower(User.email) == normalized).first()
    if user:
        if user.password_setup_token:
            deliverability = check_email_deliverability(normalized)
            if not deliverability["deliverable"]:
                return _merge_deliverability({
                    "available": False,
                    "deliverable": False,
                    "reason": "undeliverable",
                    "message": deliverability["message"],
                }, deliverability)
            return _merge_deliverability({
                "available": True,
                "deliverable": True,
                "reason": "incomplete_registration",
                "message": "You can submit again to restart account setup for this email.",
            }, deliverability)
        return {
            "available": False,
            "deliverable": True,
            "reason": "registered",
            "message": "This email is already registered. Please sign in instead.",
        }

    row = db.query(AccessRequest).filter(func.lower(AccessRequest.email) == normalized).first()
    if row:
        if row.status == "pending_approval":
            return {
                "available": False,
                "deliverable": True,
                "reason": "pending_approval",
                "message": "An access request for this email is already waiting for administrator approval.",
            }
        if row.status == "pending_verification":
            return {
                "available": False,
                "deliverable": True,
                "reason": "pending_verification",
                "message": "A verification email was already sent to this address. Check your inbox to continue.",
            }
        if row.status == "active":
            return {
                "available": False,
                "deliverable": True,
                "reason": "active_request",
                "message": "This email already has an active account. Please sign in.",
            }
        if row.status == "rejected":
            deliverability = check_email_deliverability(normalized)
            if not deliverability["deliverable"]:
                return _merge_deliverability({
                    "available": False,
                    "deliverable": False,
                    "reason": "undeliverable",
                    "message": deliverability["message"],
                }, deliverability)
            return _merge_deliverability({
                "available": True,
                "deliverable": True,
                "reason": "rejected_retry",
                "message": "You can submit a new request with this email.",
            }, deliverability)

    deliverability = check_email_deliverability(normalized)
    if not deliverability["deliverable"]:
        return _merge_deliverability({
            "available": False,
            "deliverable": False,
            "reason": "undeliverable",
            "message": deliverability["message"],
        }, deliverability)

    return _merge_deliverability({
        "available": True,
        "deliverable": True,
        "reason": "ok",
        "message": deliverability["message"],
    }, deliverability)


class LoginRequest(BaseModel):
    """`email` may be the user's registered email or username."""
    email: str
    password: str


class RequestDemoPayload(BaseModel):
    full_name: str
    email: EmailStr
    organization: str
    use_case: Optional[str] = ""

    @field_validator("email")
    @classmethod
    def email_must_pass_dns_mx(cls, value: str) -> str:
        """Format check (EmailStr) plus live DNS/MX lookup — not regex-only."""
        require_deliverable_email(str(value))
        return str(value).strip().lower()


class ForgotPasswordRequest(BaseModel):
    """Email or username — same as the login form."""
    identifier: str = Field(..., min_length=1, max_length=255)


class ProvisionAccessRequestBody(BaseModel):
    provisioned_username: str = Field(..., min_length=1, max_length=64)


class CreateUserRequest(BaseModel):
    username: str
    password: str = Field(..., min_length=6)
    role: str = "clinic_staff"
    assigned_clinic: str = ""
    assigned_area: str = ""
    full_name: str = ""
    email: str = ""


class UpdateUserRequest(BaseModel):
    role: Optional[str] = None
    assigned_clinic: Optional[str] = None
    assigned_area: Optional[str] = None
    full_name: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None


class VerifyEmailRequest(BaseModel):
    token: str


class ApproveRequestPayload(BaseModel):
    username: str = Field(..., min_length=1, max_length=64)
    role: str = "clinic_staff"
    assigned_clinic: Optional[str] = ""
    assigned_area: Optional[str] = ""


class SetupPasswordRequest(BaseModel):
    token: str
    password: str = Field(..., min_length=6)


class ResetPasswordRequest(BaseModel):
    token: str
    password: str = Field(..., min_length=6)


ROLE_PREVIEWS = [
    {
        "role": "Super Admin",
        "scope": "Complete platform ownership with user and security controls.",
        "workflows": [
            "Provision trusted enterprise accounts",
            "Manage RBAC and audit policy",
            "Review security logs and session activity",
        ],
    },
    {
        "role": "Hospital Administrator",
        "scope": "Oversee outbreak intelligence for one or more hospitals.",
        "workflows": [
            "Approve clinical incident responses",
            "Monitor hospital cluster trends",
            "Authorize staff access and device safety",
        ],
    },
    {
        "role": "Clinic Staff",
        "scope": "Submit clinic-level reports and review local outbreak alerts.",
        "workflows": [
            "Record new case clusters",
            "Track treatment capacity",
            "Sync updates to area health officers",
        ],
    },
    {
        "role": "Public Health Officer",
        "scope": "Coordinate area-wide surveillance and response workflows.",
        "workflows": [
            "Review district risk dashboards",
            "Validate alerts and mitigation plans",
            "Authorize public health communications",
        ],
    },
    {
        "role": "Analyst",
        "scope": "Analyze historic trends and predictive outbreak signals.",
        "workflows": [
            "Generate trend analytics",
            "Validate predictive models",
            "Export intelligence summaries",
        ],
    },
    {
        "role": "Read-Only Observer",
        "scope": "Securely monitor reports without data modification access.",
        "workflows": [
            "View audit trails",
            "Track activity summaries",
            "Consume secure reporting dashboards",
        ],
    },
]


def _create_device_session(user: User, request: Request, db: Session) -> DeviceSession:
    device_name = request.headers.get("x-device-name") or request.headers.get("user-agent", "Web Browser").split(")")[0]
    session = DeviceSession(
        session_id=secrets.token_urlsafe(22),
        username=user.username,
        device_name=device_name,
        device_fingerprint=get_device_fingerprint(request),
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent", ""),
        trusted=False,
        created_at=_now(),
        last_seen_at=_now(),
        expires_at=(datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)).isoformat(),
        revoked=False,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.post("/login")
async def login(body: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    await enforce_rate_limit(request)

    login_id = (body.email or "").strip()
    if not login_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Enter your email or username")

    if "@" in login_id:
        user = db.query(User).filter(func.lower(User.email) == _normalize_email(login_id)).first()
    else:
        user = db.query(User).filter(User.username == login_id).first()
    if not user or not verify_password(body.password, user.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")

    if hasattr(user, "status") and user.status != "active":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Your account is not active.")

    device_session = _create_device_session(user, request, db)

    user.last_login_at = _now()
    db.commit()

    access_token = create_access_token(
        subject=user.username,
        role=user.role,
        extra={
            "assigned_clinic": user.assigned_clinic or "",
            "assigned_area": user.assigned_area or "",
            "full_name": user.full_name or "",
            "session_id": device_session.session_id,
        },
    )

    refresh_token_id, refresh_token = create_refresh_token()
    db.add(RefreshToken(
        token_id=refresh_token_id,
        token_hash=hash_token(refresh_token),
        username=user.username,
        device_session_id=device_session.id,
        created_at=_now(),
        expires_at=(datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)).isoformat(),
        revoked=False,
    ))
    db.commit()

    response.set_cookie(
        key="refresh_token",
        value=f"{refresh_token_id}.{refresh_token}",
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="strict",
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600,
        path="/",
    )

    log_activity(user.username, "LOGIN_SUCCESS", db, meta=f"ip={get_client_ip(request)}")

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "username": user.username,
        "role": user.role,
        "role_label": ROLES.get(user.role, user.role),
        "assigned_clinic": user.assigned_clinic or "",
        "assigned_area": user.assigned_area or "",
        "full_name": user.full_name or "",
        "trusted_device": bool(device_session.trusted),
    }


@router.post("/refresh")
async def refresh_token(request: Request, response: Response, db: Session = Depends(get_db)):
    cookie = request.cookies.get("refresh_token")
    if not cookie or "." not in cookie:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing refresh token")

    refresh_id, refresh_secret = cookie.split(".", 1)
    refresh = db.query(RefreshToken).filter(RefreshToken.token_id == refresh_id, RefreshToken.revoked == False).first()
    if not refresh or datetime.now(timezone.utc) > datetime.fromisoformat(refresh.expires_at):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token invalid or expired")

    if not verify_token(refresh_secret, refresh.token_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    refresh.revoked = True
    db.commit()

    user = db.query(User).filter(User.username == refresh.username).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    new_refresh_id, new_refresh_secret = create_refresh_token()
    db.add(RefreshToken(
        token_id=new_refresh_id,
        token_hash=hash_token(new_refresh_secret),
        username=user.username,
        device_session_id=refresh.device_session_id,
        created_at=_now(),
        expires_at=(datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)).isoformat(),
        revoked=False,
    ))
    db.commit()

    response.set_cookie(
        key="refresh_token",
        value=f"{new_refresh_id}.{new_refresh_secret}",
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="strict",
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600,
        path="/",
    )

    access_token = create_access_token(
        subject=user.username,
        role=user.role,
        extra={
            "assigned_clinic": user.assigned_clinic or "",
            "assigned_area": user.assigned_area or "",
            "full_name": user.full_name or "",
            "session_id": refresh.device_session_id or "",
        },
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "username": user.username,
        "role": user.role,
        "role_label": ROLES.get(user.role, user.role),
    }


@router.post("/logout")
async def logout(request: Request, response: Response, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    cookie = request.cookies.get("refresh_token")
    if cookie and "." in cookie:
        refresh_id, _ = cookie.split(".", 1)
        refresh = db.query(RefreshToken).filter(RefreshToken.token_id == refresh_id).first()
        if refresh:
            refresh.revoked = True
            db.commit()

    response.delete_cookie("refresh_token", path="/")
    log_activity(current_user["username"], "LOGOUT", db, meta=f"ip={get_client_ip(request)}")
    return {"message": "Logged out successfully"}


@router.get("/me")
async def me(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    return {
        **current_user,
        "role_label": ROLES.get(current_user["role"], current_user["role"]),
    }


@router.get("/auth/roles")
async def role_previews() -> List[dict]:
    return ROLE_PREVIEWS


@router.get("/request-demo/check-email")
async def check_request_email(email: str, db: Session = Depends(get_db)):
    return _check_access_request_email(email, db)


@router.get("/email/validate")
async def validate_email_address(email: str):
    """
    Check email format + whether the domain can receive mail (DNS/MX).
    Does not verify that the specific inbox exists.
    """
    return check_email_deliverability(email)


@router.post("/request-demo")
async def request_demo_access(body: RequestDemoPayload, request: Request, db: Session = Depends(get_db)):
    await enforce_rate_limit(request)
    normalized_email = _normalize_email(str(body.email))
    email_check = _check_access_request_email(normalized_email, db)
    if not email_check["available"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=email_check["message"])
    if not email_check.get("deliverable") or not email_check.get("mx_found"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=email_check["message"])

    # Incomplete registration — remove partial user so the request can be resubmitted cleanly
    existing_user = db.query(User).filter(func.lower(User.email) == normalized_email).first()
    if existing_user and existing_user.password_setup_token is not None:
        db.delete(existing_user)
        db.commit()

    # Find if there is an existing request for this email to reuse
    row = db.query(AccessRequest).filter(
        func.lower(AccessRequest.email) == normalized_email
    ).first()

    use_case = (body.use_case or "").strip()[:5000]

    if row:
        # Update existing request row
        row.full_name = body.full_name.strip()
        row.organization = body.organization.strip()
        row.use_case = use_case
        row.status = "pending_approval"
        row.verification_token = None
        row.verification_expires = None
        row.created_at = _now()
        db.commit()
    else:
        # Create new request row
        row = AccessRequest(
            full_name=body.full_name.strip(),
            email=normalized_email,
            organization=body.organization.strip(),
            use_case=use_case,
            created_at=_now(),
            status="pending_approval",
            verification_token=None,
            verification_expires=None,
        )
        db.add(row)
        db.commit()
        db.refresh(row)

    meta = f"email={body.email} organization={body.organization}"
    if use_case:
        meta += f" use_case={use_case[:500]}"
    log_activity("anonymous", "REQUEST_DEMO_ACCESS", db, meta=meta)
    return {
        "message": "Your request has been submitted successfully for administrator review. Once approved, you will receive an email to verify your address and complete your account registration.",
    }


@router.get("/admin/access-requests")
async def list_access_requests(
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    rows = db.query(AccessRequest).order_by(AccessRequest.id.desc()).limit(500).all()
    return [
        {
            "id": r.id,
            "full_name": r.full_name,
            "email": r.email,
            "organization": r.organization,
            "use_case": r.use_case or "",
            "created_at": r.created_at,
            "provisioned_username": r.provisioned_username or "",
            "provisioned_at": r.provisioned_at or "",
            "status": r.status or "pending_verification",
            "verification_expires": r.verification_expires or "",
        }
        for r in rows
    ]


@router.patch("/admin/access-requests/{request_id}")
async def mark_access_request_provisioned(
    request_id: int,
    body: ProvisionAccessRequestBody,
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Record intended username only — does not activate accounts (use approve + verify flow)."""
    row = db.query(AccessRequest).filter(AccessRequest.id == request_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Access request not found")
    if row.status in ("active", "rejected"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot update provisioning notes for status '{row.status}'.",
        )
    row.provisioned_username = body.provisioned_username.strip()
    db.commit()
    log_activity(
        current_user["username"],
        f"ACCESS REQUEST #{request_id} notes updated (username hint: {row.provisioned_username})",
        db,
    )
    return {
        "message": "Provisioning notes saved. Use Approve to send verification email.",
        "provisioned_username": row.provisioned_username,
    }


@router.post("/auth/verify-email")
async def verify_email(body: VerifyEmailRequest, db: Session = Depends(get_db)):
    if not body.token or not body.token.strip():
        raise HTTPException(status_code=400, detail="Invalid or expired verification token")

    plain_token = body.token.strip()
    row = find_access_request_by_verification_token(db, plain_token)
    if not row:
        raise HTTPException(status_code=400, detail="Invalid or expired verification token")

    existing_user = db.query(User).filter(func.lower(User.email) == _normalize_email(row.email)).first()
    if existing_user and existing_user.password_setup_token:
        if row.status != "active":
            row.status = "active"
            row.provisioned_username = existing_user.username
            db.commit()
        new_setup = secrets.token_urlsafe(32)
        existing_user.password_setup_token = store_token(new_setup)
        existing_user.password_setup_expires = (
            datetime.now(timezone.utc) + timedelta(days=3)
        ).isoformat()
        db.commit()
        return {
            "message": "Email verified successfully. Please configure your password to complete registration.",
            "setup_token": new_setup,
        }

    if row.status == "active":
        if existing_user:
            return {
                "message": "This account is already active. Sign in with your email or username and password.",
                "already_completed": True,
            }
        raise HTTPException(status_code=400, detail="Invalid or expired verification token")

    if row.status != "pending_verification":
        raise HTTPException(status_code=400, detail="Invalid or expired verification token")

    if row.verification_expires:
        try:
            expires = datetime.fromisoformat(row.verification_expires)
            if expires.tzinfo is None:
                expires = expires.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) > expires:
                row.status = "expired"
                db.commit()
                raise HTTPException(status_code=400, detail="Verification link has expired. Please submit a new request.")
        except Exception:
            pass

    # Safe check if username is already taken when the user verifies
    username = row.provisioned_username
    if db.query(User).filter(User.username == username).first():
        username = f"{username}_{secrets.token_hex(2)}"

    # Generate setup token
    setup_token_plain = secrets.token_urlsafe(32)
    setup_expires = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()

    temp_pwd_hash = hash_password(secrets.token_urlsafe(16))

    user = User(
        username=username,
        password=temp_pwd_hash,
        role=row.provisioned_role or "clinic_staff",
        assigned_clinic=row.provisioned_clinic or "",
        assigned_area=row.provisioned_area or "",
        full_name=row.full_name,
        email=_normalize_email(row.email),
        status="active",
        password_setup_token=store_token(setup_token_plain),
        password_setup_expires=setup_expires,
    )
    db.add(user)

    row.status = "active"
    row.provisioned_username = username
    db.commit()

    log_activity("anonymous", f"EMAIL_VERIFIED: {row.email} (user {username} created)", db)
    return {
        "message": "Email verified successfully. Please configure your password to complete registration.",
        "setup_token": setup_token_plain,
    }


@router.post("/admin/access-requests/{request_id}/approve")
async def approve_access_request(
    request_id: int,
    body: ApproveRequestPayload,
    request: Request,
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    row = db.query(AccessRequest).filter(AccessRequest.id == request_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Access request not found")
    if row.status != "pending_approval":
        raise HTTPException(status_code=400, detail=f"Request is in status '{row.status}' and cannot be approved. It must be pending approval first.")

    # Check username
    if db.query(User).filter(User.username == body.username.strip()).first():
        raise HTTPException(status_code=409, detail="Username already exists")

    # Generate verification token
    verification_token = secrets.token_urlsafe(32)
    verification_expires = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()

    # Pre-provision details on the request row
    row.provisioned_username = body.username.strip()
    row.provisioned_role = body.role
    row.provisioned_clinic = body.assigned_clinic or ""
    row.provisioned_area = body.assigned_area or ""
    row.provisioned_at = _now()
    row.status = "pending_verification"
    row.verification_token = store_token(verification_token)
    row.verification_expires = verification_expires

    db.commit()

    verify_url = f"{_app_public_url(request)}/verify-email?token={verification_token}"

    delivery = send_verification_email(row.email, row.full_name, verify_url)
    if not delivery.success:
        row.status = "pending_approval"
        row.verification_token = None
        row.verification_expires = None
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=_delivery_user_message(delivery),
        )

    log_activity(current_user["username"], f"APPROVED ACCESS REQUEST #{request_id} (verification sent to {row.email})", db)
    payload = {"message": "Access request approved. A verification email has been sent to the user."}
    if os.getenv("EPICAST_ENV", "development").lower() != "production":
        payload["verification_token"] = verification_token
    return payload


@router.post("/admin/access-requests/{request_id}/reject")
async def reject_access_request(
    request_id: int,
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    row = db.query(AccessRequest).filter(AccessRequest.id == request_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Access request not found")
    if row.status in ("active", "rejected"):
        raise HTTPException(status_code=400, detail=f"Request is already '{row.status}'")

    row.status = "rejected"
    db.commit()
    log_activity(current_user["username"], f"REJECTED ACCESS REQUEST #{request_id}", db)
    return {"message": "Access request rejected."}


@router.post("/auth/setup-password")
async def setup_password(body: SetupPasswordRequest, db: Session = Depends(get_db)):
    if not body.token or not body.token.strip():
        raise HTTPException(status_code=400, detail="Invalid or expired setup token")

    user = find_user_by_setup_token(db, body.token.strip())
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired setup token")

    if user.password_setup_expires:
        try:
            expires = datetime.fromisoformat(user.password_setup_expires)
            if expires.tzinfo is None:
                expires = expires.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) > expires:
                user.password_setup_token = None
                user.password_setup_expires = None
                db.commit()
                raise HTTPException(status_code=400, detail="Password setup link has expired. Please contact the administrator.")
        except Exception:
            pass

    user.password = hash_password(body.password)
    user.password_setup_token = None
    user.password_setup_expires = None
    db.commit()

    log_activity(user.username, "PASSWORD_SETUP_COMPLETE", db)
    return {"message": "Password configured successfully. You can now log in."}


def _find_user_by_identifier(identifier: str, db: Session) -> User | None:
    raw = (identifier or "").strip()
    if not raw:
        return None
    if "@" in raw:
        normalized = _normalize_email(raw)
        return db.query(User).filter(func.lower(User.email) == normalized).first()
    return db.query(User).filter(User.username == raw).first()


@router.post("/auth/forgot-password")
async def forgot_password(body: ForgotPasswordRequest, request: Request, db: Session = Depends(get_db)):
    await enforce_rate_limit(request)
    identifier = body.identifier.strip()
    generic_message = "If this account exists, you will receive password reset instructions shortly."

    user = _find_user_by_identifier(identifier, db)

    log_activity(
        user.username if user else identifier,
        "FORGOT_PASSWORD_REQUEST",
        db,
        meta=f"identifier={identifier}",
    )

    if not user or not user.email or user.password_setup_token:
        return {"message": generic_message}

    reset_token = secrets.token_urlsafe(32)
    user.password_reset_token = store_token(reset_token)
    user.password_reset_expires = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()

    reset_url = f"{_app_public_url(request)}/reset-password?token={reset_token}"

    delivery = send_password_reset_email(user.email, user.full_name or user.username, reset_url)
    if not delivery.success:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=_delivery_user_message(delivery),
        )
    db.commit()

    return {"message": _delivery_user_message(delivery), "delivery_mode": delivery.provider}


@router.post("/auth/reset-password")
async def reset_password(body: ResetPasswordRequest, db: Session = Depends(get_db)):
    if not body.token or not body.token.strip():
        raise HTTPException(status_code=400, detail="Invalid or expired reset link")

    user = find_user_by_reset_token(db, body.token.strip())
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link")

    if user.password_reset_expires:
        try:
            expires = datetime.fromisoformat(user.password_reset_expires)
            if expires.tzinfo is None:
                expires = expires.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) > expires:
                user.password_reset_token = None
                user.password_reset_expires = None
                db.commit()
                raise HTTPException(status_code=400, detail="Password reset link has expired. Request a new one.")
        except HTTPException:
            raise
        except Exception:
            pass

    user.password = hash_password(body.password)
    user.password_reset_token = None
    user.password_reset_expires = None
    db.commit()
    log_activity(user.username, "PASSWORD_RESET_COMPLETE", db)
    return {"message": "Password updated successfully. You can now sign in."}


@router.get("/auth/sessions")
async def active_sessions(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    sessions = db.query(DeviceSession).filter(DeviceSession.username == current_user["username"], DeviceSession.revoked == False).all()
    return [
        {
            "device_name": s.device_name,
            "ip_address": s.ip_address,
            "trusted": s.trusted,
            "last_seen_at": s.last_seen_at,
            "expires_at": s.expires_at,
        }
        for s in sessions
    ]


@router.get("/admin/users")
async def list_users(
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    users = db.query(User).all()
    return [
        {
            "id":              u.id,
            "username":        u.username,
            "role":            u.role,
            "role_label":      ROLES.get(u.role, u.role),
            "assigned_clinic": u.assigned_clinic or "",
            "assigned_area":   u.assigned_area or "",
            "full_name":       u.full_name or "",
            "email":           u.email or "",
        }
        for u in users
    ]


@router.post("/admin/users", status_code=status.HTTP_201_CREATED)
async def create_user(
    body: CreateUserRequest,
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if body.role not in ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Valid: {list(ROLES.keys())}")

    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(status_code=409, detail="Username already exists")

    email_norm = _normalize_email(body.email) if body.email else ""
    if email_norm and db.query(User).filter(func.lower(User.email) == email_norm).first():
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        username=body.username,
        password=hash_password(body.password),
        role=body.role,
        assigned_clinic=body.assigned_clinic,
        assigned_area=body.assigned_area,
        full_name=body.full_name,
        email=email_norm,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    log_activity(current_user["username"], f"CREATED USER: {body.username} ({body.role})", db)
    return {
        "id": user.id,
        "username": user.username,
        "role": user.role,
        "message": "User created successfully",
    }


@router.patch("/admin/users/{user_id}")
async def update_user(
    user_id: int,
    body: UpdateUserRequest,
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if body.role is not None:
        if body.role not in ROLES:
            raise HTTPException(status_code=400, detail="Invalid role")
        user.role = body.role
    if body.assigned_clinic is not None:
        user.assigned_clinic = body.assigned_clinic
    if body.assigned_area is not None:
        user.assigned_area = body.assigned_area
    if body.full_name is not None:
        user.full_name = body.full_name
    if body.email is not None:
        user.email = body.email
    if body.password is not None and body.password.strip():
        user.password = hash_password(body.password)

    db.commit()
    log_activity(current_user["username"], f"UPDATED USER: {user.username}", db)
    return {"message": f"User {user.username} updated"}


@router.delete("/admin/users/{user_id}")
async def delete_user(
    user_id: int,
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.username == current_user["username"]:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    db.delete(user)
    db.commit()
    log_activity(current_user["username"], f"DELETED USER: {user.username}", db)
    return {"message": f"User {user.username} deleted"}
