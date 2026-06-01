"""
email_service.py — Production email delivery for EPICAST (Resend API + optional SMTP fallback).
"""

import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()

import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import httpx

RESEND_API_KEY = os.getenv("RESEND_API_KEY", "").strip()
RESEND_FROM_RAW = os.getenv("RESEND_FROM", "Epicast <onboarding@resend.dev>")

SMTP_HOST = os.getenv("SMTP_HOST", "").strip()
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "").strip()
# Gmail app passwords are often pasted as "xxxx xxxx xxxx xxxx" — strip spaces
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "").replace(" ", "").strip()
SMTP_FROM = os.getenv("SMTP_FROM", "").strip()
SMTP_TLS = os.getenv("SMTP_TLS", "True").lower() in ("true", "1", "yes")
SMTP_SSL = os.getenv("SMTP_SSL", "False").lower() in ("true", "1", "yes")

EPICAST_ENV = os.getenv("EPICAST_ENV", "development").strip().lower()
IS_PRODUCTION = EPICAST_ENV == "production"
EMAIL_FORCE_CONSOLE = os.getenv("EMAIL_FORCE_CONSOLE", "false").lower() in ("true", "1", "yes")
# Off by default in production; console never counts as real delivery when EPICAST_ENV=production
EMAIL_ALLOW_CONSOLE_FALLBACK = os.getenv(
    "EMAIL_ALLOW_CONSOLE_FALLBACK",
    "false" if IS_PRODUCTION else "true",
).lower() in ("true", "1", "yes")

_resend_key_invalid = False


@dataclass
class EmailDeliveryResult:
    success: bool
    provider: str  # resend | smtp | console | none
    error: str | None = None
    delivered_to: str | None = None
    intended_to: str | None = None


def _normalize_from_address(raw: str) -> str:
    value = (raw or "").strip()
    if not value:
        return "Epicast <onboarding@resend.dev>"
    if "<" in value and ">" in value:
        return value
    if "@" in value:
        return f"Epicast <{value}>"
    return value


RESEND_FROM = _normalize_from_address(RESEND_FROM_RAW)


def _is_resend_test_sender() -> bool:
    return "resend.dev" in (RESEND_FROM or "").lower()


def resend_production_ready() -> bool:
    """Resend can deliver to any recipient when using a verified sending domain."""
    return bool(RESEND_API_KEY) and not _resend_key_invalid and not _is_resend_test_sender()


def _smtp_ready() -> bool:
    return bool(SMTP_HOST and SMTP_USERNAME and SMTP_PASSWORD)


def validate_email_config() -> list[str]:
    """Return configuration issues (empty list = ready for real delivery)."""
    issues: list[str] = []
    if not RESEND_API_KEY and not _smtp_ready():
        issues.append("Set RESEND_API_KEY or SMTP_HOST + SMTP_USERNAME + SMTP_PASSWORD in backend/.env.")
    if RESEND_API_KEY and _is_resend_test_sender() and not _smtp_ready():
        issues.append(
            "No real inbox delivery: set Gmail SMTP below, or verify a domain at "
            "https://resend.com/domains and set RESEND_FROM=Epicast <noreply@yourdomain.com>."
        )
    if IS_PRODUCTION and EMAIL_ALLOW_CONSOLE_FALLBACK:
        issues.append("Set EMAIL_ALLOW_CONSOLE_FALLBACK=false in production.")
    if IS_PRODUCTION and not os.getenv("APP_PUBLIC_URL", "").strip():
        issues.append("Set APP_PUBLIC_URL to your deployed frontend URL (used in email links).")
    return issues


def email_provider_status() -> dict:
    return {
        "environment": EPICAST_ENV,
        "production": IS_PRODUCTION,
        "resend_configured": bool(RESEND_API_KEY),
        "resend_production_ready": resend_production_ready(),
        "resend_test_sender": _is_resend_test_sender(),
        "resend_key_invalid": _resend_key_invalid,
        "smtp_configured": _smtp_ready(),
        "console_fallback": EMAIL_ALLOW_CONSOLE_FALLBACK and not IS_PRODUCTION,
        "from_address": RESEND_FROM,
        "config_issues": validate_email_config(),
    }


def send_html_email(to_email: str, subject: str, html_content: str, text_content: str = "") -> EmailDeliveryResult:
    intended_to = to_email.strip()
    if not intended_to:
        return EmailDeliveryResult(False, "none", error="Missing recipient email.")

    if IS_PRODUCTION and not _smtp_ready() and not resend_production_ready():
        config_issues = validate_email_config()
        if config_issues:
            return EmailDeliveryResult(
                False,
                "none",
                error=config_issues[0],
                intended_to=intended_to,
            )

    if EMAIL_FORCE_CONSOLE and not IS_PRODUCTION:
        return _console_fallback(intended_to, subject, html_content, text_content, intended_to)

    global _resend_key_invalid

    if resend_production_ready():
        result = _send_via_resend(intended_to, subject, html_content, text_content, intended_to)
        if result.success:
            return result

    smtp_error: EmailDeliveryResult | None = None
    if _smtp_ready():
        smtp_error = _send_via_smtp(intended_to, subject, html_content, text_content, intended_to)
        if smtp_error.success:
            return smtp_error

    if RESEND_API_KEY and not _resend_key_invalid and not IS_PRODUCTION:
        result = _send_via_resend(intended_to, subject, html_content, text_content, intended_to)
        if result.success:
            return result
        if _resend_key_invalid:
            return result

    if EMAIL_ALLOW_CONSOLE_FALLBACK and not IS_PRODUCTION:
        return _console_fallback(intended_to, subject, html_content, text_content, intended_to)

    if smtp_error and smtp_error.error:
        return smtp_error

    if RESEND_API_KEY and not _resend_key_invalid:
        resend_error = _send_via_resend(intended_to, subject, html_content, text_content, intended_to)
        if resend_error.error:
            return resend_error

    issues = validate_email_config()
    if issues:
        return EmailDeliveryResult(False, "none", error=issues[0], intended_to=intended_to)

    return EmailDeliveryResult(
        False,
        "none",
        error="Email could not be sent. Configure Gmail SMTP (SMTP_USERNAME, SMTP_PASSWORD) in backend/.env.",
        intended_to=intended_to,
    )


def _send_via_resend(
    to_email: str,
    subject: str,
    html_content: str,
    text_content: str,
    intended_to: str,
) -> EmailDeliveryResult:
    global _resend_key_invalid
    try:
        payload = {
            "from": RESEND_FROM,
            "to": [to_email],
            "subject": subject,
            "html": html_content,
        }
        if text_content:
            payload["text"] = text_content

        response = httpx.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {RESEND_API_KEY}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=15.0,
        )
        if response.status_code in (200, 201, 202):
            print(f"[Email Service] [Resend] Sent to {to_email}: {subject}")
            return EmailDeliveryResult(
                True,
                "resend",
                delivered_to=to_email,
                intended_to=intended_to,
            )

        detail = response.text
        try:
            detail = response.json().get("message", detail)
        except Exception:
            pass

        if response.status_code == 401:
            _resend_key_invalid = True
            detail = "Resend API key is invalid. Update RESEND_API_KEY in backend/.env."

        print(f"[Email Service] [Resend] Failed ({response.status_code}): {detail}")
        return EmailDeliveryResult(
            False,
            "resend",
            error=detail,
            intended_to=intended_to,
        )
    except Exception as exc:
        print(f"[Email Service] [Resend] Error: {exc}")
        return EmailDeliveryResult(False, "resend", error=str(exc), intended_to=intended_to)


def _send_via_smtp(
    to_email: str,
    subject: str,
    html_content: str,
    text_content: str,
    intended_to: str,
) -> EmailDeliveryResult:
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = SMTP_FROM or SMTP_USERNAME
        msg["To"] = to_email
        if text_content:
            msg.attach(MIMEText(text_content, "plain"))
        msg.attach(MIMEText(html_content, "html"))

        if SMTP_SSL:
            server = smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=15.0)
        else:
            server = smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15.0)
            if SMTP_TLS:
                server.starttls()
        server.login(SMTP_USERNAME, SMTP_PASSWORD)
        server.sendmail(msg["From"], [to_email], msg.as_string())
        server.quit()
        print(f"[Email Service] [SMTP] Sent to {to_email}: {subject}")
        return EmailDeliveryResult(True, "smtp", delivered_to=to_email, intended_to=intended_to)
    except Exception as exc:
        print(f"[Email Service] [SMTP] Error: {exc}")
        return EmailDeliveryResult(False, "smtp", error=str(exc), intended_to=intended_to)


def _console_fallback(
    to_email: str,
    subject: str,
    html_content: str,
    text_content: str,
    intended_to: str,
) -> EmailDeliveryResult:
    print("\n" + "=" * 80)
    print(" [EMAIL — DEV CONSOLE ONLY] (not delivered to a real inbox)")
    print(f" To:      {to_email}")
    print(f" Subject: {subject}")
    print(f" Text:    {text_content or 'See HTML below'}")
    print("-" * 80)
    print(html_content)
    print("=" * 80 + "\n")
    # In development, allow workflows to continue while domain DNS is being verified.
    return EmailDeliveryResult(
        not IS_PRODUCTION,
        "console",
        delivered_to=to_email,
        intended_to=intended_to,
        error=None if not IS_PRODUCTION else "Development mode: email logged to the server console only.",
    )


def _delivery_user_message(result: EmailDeliveryResult) -> str:
    if result.success and result.provider in ("resend", "smtp"):
        return "Email sent. Ask the recipient to check inbox and spam."

    if result.provider == "console" or (result.error and "development mode" in result.error.lower()):
        return (
            "Email was not sent to a real inbox (development console only). "
            "For production, verify your domain at https://resend.com/domains and update RESEND_FROM."
        )

    if result.error:
        err = result.error.lower()
        if "535" in err or "badcredentials" in err or "username and password not accepted" in err:
            return (
                "Gmail rejected the SMTP login. Use an App Password (not your normal Gmail password): "
                "https://myaccount.google.com/apppasswords — same address as SMTP_USERNAME, 2-Step Verification required."
            )
        if "only send testing emails" in err or "resend.dev" in err or "verify a domain" in err:
            return (
                "Transactional email is not configured for production. "
                "Verify your organization domain at https://resend.com/domains, then set "
                "RESEND_FROM=Epicast <noreply@yourdomain.com> in backend/.env and restart the API."
            )
        return result.error

    return "Could not send email."


def send_password_reset_email(to_email: str, full_name: str, reset_url: str) -> EmailDeliveryResult:
    greeting = full_name.strip() or "there"
    subject = "Reset your EPICAST password"
    text_content = (
        f"Hello {greeting},\n\n"
        f"We received a request to reset your EPICAST password.\n\n"
        f"Open this link to choose a new password (expires in 1 hour):\n{reset_url}\n\n"
        f"If you did not request this, you can ignore this email.\n"
    )
    html_content = f"""<!DOCTYPE html>
<html><body style="font-family: sans-serif; color: #1f2937; max-width: 560px;">
  <p>Hello {greeting},</p>
  <p>We received a request to reset your EPICAST password.</p>
  <p style="margin: 28px 0;">
    <a href="{reset_url}" style="background:#0f172a;color:#fff;padding:14px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
      Reset password
    </a>
  </p>
  <p style="color:#6b7280;font-size:13px;">This link expires in 1 hour. If you did not request a reset, ignore this email.</p>
  <p style="word-break:break-all;font-size:12px;color:#9ca3af;">{reset_url}</p>
</body></html>"""
    return send_html_email(to_email, subject, html_content, text_content)


def send_verification_email(to_email: str, full_name: str, verification_url: str) -> EmailDeliveryResult:
    subject = "Verify your email for EPICAST Access"
    text_content = (
        f"Hello {full_name},\n\n"
        f"Please verify your email by clicking the link below:\n{verification_url}\n\n"
        f"This link will expire in 24 hours.\n"
    )
    html_content = f"""<!DOCTYPE html>
<html><body style="font-family: sans-serif; color: #1f2937;">
  <p>Hello {full_name},</p>
  <p>Please verify your email for EPICAST access:</p>
  <p><a href="{verification_url}">Verify email address</a></p>
  <p style="font-size:12px;color:#6b7280;">{verification_url}</p>
</body></html>"""
    return send_html_email(to_email, subject, html_content, text_content)


def send_approval_email(
    to_email: str,
    full_name: str,
    username: str,
    role_label: str,
    login_url: str,
    setup_url: str,
) -> EmailDeliveryResult:
    subject = "Your EPICAST Account is Active"
    text_content = (
        f"Hello {full_name},\n\n"
        f"Your EPICAST account is active.\n\n"
        f"Username: {username}\nRole: {role_label}\n\n"
        f"Set your password: {setup_url}\nLogin: {login_url}\n"
    )
    html_content = f"""<!DOCTYPE html>
<html><body style="font-family: sans-serif; color: #1f2937;">
  <p>Hello {full_name},</p>
  <p>Your EPICAST account is active.</p>
  <p><strong>Username:</strong> {username}<br><strong>Role:</strong> {role_label}</p>
  <p><a href="{setup_url}" style="background:#10b981;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;">Set up password</a></p>
</body></html>"""
    return send_html_email(to_email, subject, html_content, text_content)
