"""
email_validation.py — Real deliverability checks via DNS/MX (not regex-only).

Uses the email-validator library + dnspython to look up mail servers for the domain.
This is stronger than format/regex checks; it does not prove a specific inbox exists.
"""

import os
from functools import lru_cache

from email_validator import validate_email
from email_validator.deliverability import caching_resolver
from email_validator.exceptions import EmailNotValidError, EmailSyntaxError, EmailUndeliverableError

CHECK_METHOD = "dns_mx"


@lru_cache(maxsize=1)
def _dns_resolver():
    timeout = float(os.getenv("EMAIL_DNS_TIMEOUT", "10"))
    return caching_resolver(timeout=timeout)


def check_email_deliverability(email: str) -> dict:
    """
    Validate address format, then query DNS for MX (mail exchange) records.

    Returns deliverable=True only when a live DNS lookup finds mail servers for the domain.
    """
    normalized_input = (email or "").strip()
    if not normalized_input:
        return _result(
            deliverable=False,
            syntax_valid=False,
            mx_found=False,
            normalized=None,
            domain=None,
            mx_hosts=[],
            message="Please enter a valid work email address.",
        )

    try:
        info = validate_email(
            normalized_input,
            check_deliverability=True,
            dns_resolver=_dns_resolver(),
        )
        mx_hosts = [host for _prio, host in (info.mx or [])]
        if not mx_hosts and info.mx_fallback_type:
            mx_hosts = [f"(via {info.mx_fallback_type} record)"]

        return _result(
            deliverable=True,
            syntax_valid=True,
            mx_found=True,
            normalized=info.normalized,
            domain=info.domain,
            mx_hosts=mx_hosts[:5],
            message="This email address looks valid.",
        )
    except EmailSyntaxError:
        return _result(
            deliverable=False,
            syntax_valid=False,
            mx_found=False,
            normalized=None,
            domain=None,
            mx_hosts=[],
            message="Invalid email format (not just missing @ — the address structure is wrong).",
        )
    except EmailUndeliverableError:
        return _result(
            deliverable=False,
            syntax_valid=True,
            mx_found=False,
            normalized=None,
            domain=normalized_input.split("@")[-1] if "@" in normalized_input else None,
            mx_hosts=[],
            message=(
                "DNS lookup found no mail server (MX) for this domain. "
                "Typo domains like fakecompany.xyz are rejected — use a real work email."
            ),
        )
    except EmailNotValidError as exc:
        return _result(
            deliverable=False,
            syntax_valid=False,
            mx_found=False,
            normalized=None,
            domain=None,
            mx_hosts=[],
            message=_friendly_deliverability_message(exc),
        )


def require_deliverable_email(email: str) -> dict:
    """Raise ValueError if DNS/MX validation fails (for Pydantic / route guards)."""
    result = check_email_deliverability(email)
    if not result["deliverable"] or not result["mx_found"]:
        raise ValueError(result["message"])
    return result


def _result(
    *,
    deliverable: bool,
    syntax_valid: bool,
    mx_found: bool,
    normalized: str | None,
    domain: str | None,
    mx_hosts: list[str],
    message: str,
) -> dict:
    return {
        "deliverable": deliverable,
        "syntax_valid": syntax_valid,
        "mx_found": mx_found,
        "check_method": CHECK_METHOD,
        "normalized": normalized,
        "domain": domain,
        "mx_hosts": mx_hosts,
        "message": message,
    }


def _friendly_deliverability_message(exc: EmailNotValidError) -> str:
    text = str(exc).lower()
    if "mx" in text or "dns" in text or "domain" in text:
        return (
            "DNS could not verify a mail server for this domain. "
            "Check spelling (.com vs .co) or use your organization email."
        )
    if "syntax" in text or "format" in text:
        return "Invalid email format."
    return "This email address could not be verified for mail delivery."
