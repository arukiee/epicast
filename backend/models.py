"""
models.py — SQLAlchemy ORM models for all Epicast tables
"""

from sqlalchemy import Column, Integer, String, Float, Text, Boolean, ForeignKey
from database import Base


class User(Base):
    """Healthcare platform users with role-based access."""
    __tablename__ = "users"

    id               = Column(Integer, primary_key=True, autoincrement=True)
    username         = Column(String,  unique=True, nullable=False, index=True)
    password         = Column(String,  nullable=False)          # bcrypt hashed
    role             = Column(String,  default="clinic_staff")  # admin | hospital_staff | clinic_staff | public_health_officer | analyst | observer
    assigned_clinic  = Column(String,  default="")              # clinic name this user belongs to
    assigned_area    = Column(String,  default="")              # area name this user belongs to
    full_name        = Column(String,  default="")
    email            = Column(String,  default="")
    mfa_enabled      = Column(Boolean, default=False)
    mfa_method       = Column(String,  default="email")
    last_login_at    = Column(String,  default="")
    status           = Column(String,  default="active")  # active | inactive
    password_setup_token = Column(String, nullable=True, index=True)
    password_setup_expires = Column(String, nullable=True)
    password_reset_token = Column(String, nullable=True, index=True)
    password_reset_expires = Column(String, nullable=True)


class DeviceSession(Base):
    """Trusted device and session metadata."""
    __tablename__ = "device_sessions"

    id                 = Column(Integer, primary_key=True, autoincrement=True)
    session_id         = Column(String,  unique=True, nullable=False, index=True)
    username           = Column(String,  nullable=False, index=True)
    device_name        = Column(String,  default="Unknown device")
    device_fingerprint = Column(String,  default="")
    ip_address         = Column(String,  default="")
    user_agent         = Column(String,  default="")
    trusted            = Column(Boolean, default=False)
    created_at         = Column(String,  nullable=False)
    last_seen_at       = Column(String,  nullable=False)
    expires_at         = Column(String,  nullable=False)
    revoked            = Column(Boolean, default=False)


class RefreshToken(Base):
    """Refresh token records for secure token rotation."""
    __tablename__ = "refresh_tokens"

    id                = Column(Integer, primary_key=True, autoincrement=True)
    token_id          = Column(String,  unique=True, nullable=False, index=True)
    token_hash        = Column(String,  nullable=False)
    username          = Column(String,  nullable=False, index=True)
    device_session_id = Column(Integer, ForeignKey("device_sessions.id"), nullable=True)
    created_at        = Column(String,  nullable=False)
    expires_at        = Column(String,  nullable=False)
    revoked           = Column(Boolean, default=False)


class MfaChallenge(Base):
    """One-time MFA challenges for secure second-factor verification."""
    __tablename__ = "mfa_challenges"

    id                = Column(Integer, primary_key=True, autoincrement=True)
    challenge_id      = Column(String,  unique=True, nullable=False, index=True)
    username          = Column(String,  nullable=False, index=True)
    method            = Column(String,  nullable=False, default="email")
    code_hash         = Column(String,  nullable=False)
    created_at        = Column(String,  nullable=False)
    expires_at        = Column(String,  nullable=False)
    used              = Column(Boolean, default=False)
    device_session_id = Column(Integer, ForeignKey("device_sessions.id"), nullable=True)


class Report(Base):
    """Clinic-level disease reports in Hyderabad."""
    __tablename__ = "reports"

    id           = Column(Integer, primary_key=True, autoincrement=True)
    area_id      = Column(String, nullable=False, index=True)
    area_name    = Column(String, nullable=False)
    clinic_name  = Column(String, nullable=False, default="")
    latitude     = Column(Float,  nullable=False)
    longitude    = Column(Float,  nullable=False)
    disease_name = Column(String, nullable=False, index=True)
    case_count   = Column(Integer, default=0)
    death_count  = Column(Integer, default=0)
    timestamp    = Column(String, nullable=False)


class Alert(Base):
    """Area-level outbreak alerts."""
    __tablename__ = "alerts"

    id                  = Column(Integer, primary_key=True, autoincrement=True)
    area_id             = Column(String, nullable=False)
    area_name           = Column(String, nullable=False, default="")
    disease_name        = Column(String, nullable=False)
    message             = Column(Text,   nullable=False)
    clinics_involved    = Column(Integer, default=1)          # count of clinics in cluster
    affected_clinics    = Column(String,  default="")         # comma-sep clinic names
    risk_level          = Column(String,  default="YELLOW")   # RED | YELLOW
    status              = Column(String,  default="active")   # active | acknowledged
    timestamp           = Column(String,  nullable=False)


class ActivityLog(Base):
    """Audit trail."""
    __tablename__ = "activity_logs"

    id        = Column(Integer, primary_key=True, autoincrement=True)
    username  = Column(String, nullable=False)
    action    = Column(String, nullable=False)
    timestamp = Column(String, nullable=False)


class EmailVerificationCode(Base):
    """One-time codes to prove an access-request email inbox is reachable."""
    __tablename__ = "email_verification_codes"

    id         = Column(Integer, primary_key=True, autoincrement=True)
    email      = Column(String, nullable=False, index=True)
    code_hash  = Column(String, nullable=False)
    created_at = Column(String, nullable=False)
    expires_at = Column(String, nullable=False)
    used       = Column(Boolean, default=False)


class AccessRequest(Base):
    """Public signup / demo access form submissions (admin inbox)."""
    __tablename__ = "access_requests"

    id                     = Column(Integer, primary_key=True, autoincrement=True)
    full_name              = Column(String, nullable=False)
    email                  = Column(String, nullable=False, index=True)
    organization           = Column(String, nullable=False)
    use_case               = Column(Text,   default="")
    created_at             = Column(String, nullable=False)
    provisioned_username   = Column(String, default="")
    provisioned_role       = Column(String, default="")
    provisioned_clinic     = Column(String, default="")
    provisioned_area       = Column(String, default="")
    provisioned_at         = Column(String, default="")
    status                 = Column(String, default="pending_approval")
    verification_token     = Column(String, nullable=True, index=True)
    verification_expires   = Column(String, nullable=True)
