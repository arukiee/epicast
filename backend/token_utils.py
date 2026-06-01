"""
token_utils.py — Hash and verify one-time tokens (email verify, setup, reset).
Supports legacy plaintext tokens in DB until rotated on next write.
"""

import secrets
from typing import Optional

from sqlalchemy.orm import Session

from auth import hash_token, verify_token


def store_token(plain: str) -> str:
    return hash_token(plain)


def token_matches(plain: str, stored: Optional[str]) -> bool:
    if not plain or not stored:
        return False
    if stored.startswith("$2"):
        return verify_token(plain, stored)
    return secrets.compare_digest(plain, stored)


def find_access_request_by_verification_token(db: Session, plain: str):
    from models import AccessRequest

    for row in db.query(AccessRequest).filter(
        AccessRequest.verification_token.isnot(None)
    ).all():
        if token_matches(plain, row.verification_token):
            return row
    return None


def find_user_by_setup_token(db: Session, plain: str):
    from models import User

    for user in db.query(User).filter(User.password_setup_token.isnot(None)).all():
        if token_matches(plain, user.password_setup_token):
            return user
    return None


def find_user_by_reset_token(db: Session, plain: str):
    from models import User

    for user in db.query(User).filter(User.password_reset_token.isnot(None)).all():
        if token_matches(plain, user.password_reset_token):
            return user
    return None
