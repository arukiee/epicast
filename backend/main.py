"""
main.py — Epicast FastAPI entry point
"""

import os
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from database import engine, SessionLocal
from models import Base, User
from auth import hash_password

from routes.auth_routes      import router as auth_router
from routes.report_routes    import router as report_router
from routes.dashboard_routes import router as dashboard_router
from routes.alert_routes     import router as alert_router
from routes.log_routes       import router as log_router
from routes.weather_routes   import router as weather_router
from routes.intel_routes     import router as intel_router

import asyncio
from contextlib import asynccontextmanager
from tasks import start_cleanup_task


def _log_email_setup():
    from email_service import email_provider_status, validate_email_config, RESEND_FROM
    status = email_provider_status()
    env = status.get("environment", "development")
    if status["resend_production_ready"]:
        print(f"[Epicast] Email: production Resend ready (from {RESEND_FROM}).")
    elif status["smtp_configured"]:
        print("[Epicast] Email: SMTP fallback configured.")
    else:
        print(f"[Epicast] Email: not production-ready (EPICAST_ENV={env}).")
    for issue in validate_email_config():
        print(f"[Epicast] Email setup: {issue}")


def _validate_production_config():
    env = os.getenv("EPICAST_ENV", "development").lower()
    if env != "production":
        return
    secret = os.getenv("EPICAST_SECRET_KEY", "").strip()
    if not secret or secret == "EPICAST_SUPER_SECRET_2024_CHANGE_IN_PROD":
        raise RuntimeError(
            "EPICAST_SECRET_KEY must be set to a strong random value when EPICAST_ENV=production."
        )
    if len(secret) < 32:
        raise RuntimeError("EPICAST_SECRET_KEY must be at least 32 characters in production.")


def _cors_origins():
    """Comma-separated CORS_ORIGINS env var for explicit origin allow-listing."""
    extra = os.getenv("CORS_ORIGINS", "").strip()
    origins = [o.strip() for o in extra.split(",") if o.strip()]
    return origins if origins else None


@asynccontextmanager
async def lifespan(app: FastAPI):
    _validate_production_config()
    Base.metadata.create_all(bind=engine)
    _ensure_access_request_columns()
    _seed_users()
    _seed_hyderabad_data()
    _sync_alerts_on_startup()
    _log_email_setup()
    cleanup_task = asyncio.create_task(start_cleanup_task())
    yield
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title   = "Epicast — Hyderabad Disease Outbreak Intelligence API",
    version = "3.0.0",
    docs_url="/docs", redoc_url="/redoc",
    lifespan=lifespan,
)

_cors_list = _cors_origins()
if _cors_list:
    # Explicit origin list (production with known frontend domain)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_cors_list,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )
else:
    # Allow all origins (dev + initial production before CORS_ORIGINS is set)
    # Safe because we use Bearer tokens in Authorization header, not cookies.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "same-origin"
    response.headers["Permissions-Policy"] = "geolocation=()"
    response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"
    response.headers["Cache-Control"] = "no-store"
    return response

app.include_router(auth_router)
app.include_router(report_router)
app.include_router(dashboard_router)
app.include_router(alert_router)
app.include_router(log_router)
app.include_router(weather_router)
app.include_router(intel_router)


@app.get("/health/email")
def health_email():
    """Check whether transactional email is configured for real delivery."""
    from email_service import email_provider_status, validate_email_config
    issues = validate_email_config()
    ready = not issues or (
        email_provider_status()["resend_production_ready"]
        or email_provider_status()["smtp_configured"]
    )
    return {"ok": ready, "issues": issues, **email_provider_status()}


def _ensure_access_request_columns():
    url = str(engine.url)
    if not url.startswith("sqlite"):
        return
    from sqlalchemy import text
    with engine.begin() as conn:
        try:
            # Check access_requests table
            rows = conn.execute(text("PRAGMA table_info(access_requests)")).fetchall()
            names = {r[1] for r in rows}
            if "provisioned_username" not in names:
                conn.execute(text("ALTER TABLE access_requests ADD COLUMN provisioned_username VARCHAR DEFAULT ''"))
            if "provisioned_role" not in names:
                conn.execute(text("ALTER TABLE access_requests ADD COLUMN provisioned_role VARCHAR DEFAULT ''"))
            if "provisioned_clinic" not in names:
                conn.execute(text("ALTER TABLE access_requests ADD COLUMN provisioned_clinic VARCHAR DEFAULT ''"))
            if "provisioned_area" not in names:
                conn.execute(text("ALTER TABLE access_requests ADD COLUMN provisioned_area VARCHAR DEFAULT ''"))
            if "provisioned_at" not in names:
                conn.execute(text("ALTER TABLE access_requests ADD COLUMN provisioned_at VARCHAR DEFAULT ''"))
            if "status" not in names:
                conn.execute(text("ALTER TABLE access_requests ADD COLUMN status VARCHAR DEFAULT 'pending_approval'"))
            if "verification_token" not in names:
                conn.execute(text("ALTER TABLE access_requests ADD COLUMN verification_token VARCHAR"))
            if "verification_expires" not in names:
                conn.execute(text("ALTER TABLE access_requests ADD COLUMN verification_expires VARCHAR"))

            # Check users table
            rows_u = conn.execute(text("PRAGMA table_info(users)")).fetchall()
            names_u = {r[1] for r in rows_u}
            if "status" not in names_u:
                conn.execute(text("ALTER TABLE users ADD COLUMN status VARCHAR DEFAULT 'active'"))
            if "password_setup_token" not in names_u:
                conn.execute(text("ALTER TABLE users ADD COLUMN password_setup_token VARCHAR"))
            if "password_setup_expires" not in names_u:
                conn.execute(text("ALTER TABLE users ADD COLUMN password_setup_expires VARCHAR"))
            if "password_reset_token" not in names_u:
                conn.execute(text("ALTER TABLE users ADD COLUMN password_reset_token VARCHAR"))
            if "password_reset_expires" not in names_u:
                conn.execute(text("ALTER TABLE users ADD COLUMN password_reset_expires VARCHAR"))
        except Exception as e:
            print(f"[Epicast] Database migration error: {e}")
            return


def _seed_users():
    db = SessionLocal()
    try:
        env = os.getenv("EPICAST_ENV", "development").lower()
        admin_password = os.getenv("ADMIN_INITIAL_PASSWORD", "").strip()
        if env == "production" and not admin_password:
            print("[Epicast] [WARNING] ADMIN_INITIAL_PASSWORD not set; admin user will not be auto-created.")
            defaults = []
        else:
            pwd = admin_password if admin_password else "admin123"
            if env != "production" and not admin_password:
                print("[Epicast] [DEV] Default admin login: admin / admin123 (set ADMIN_INITIAL_PASSWORD in production)")
            defaults = [
                ("admin", pwd, "admin", "", "", "System Admin", "admin@epicast.health"),
            ]
        for uname, pwd, role, clinic, area, fname, email in defaults:
            user = db.query(User).filter(User.username == uname).first()
            if not user:
                db.add(User(
                    username=uname, password=hash_password(pwd), role=role,
                    assigned_clinic=clinic, assigned_area=area,
                    full_name=fname, email=email.lower(), status="active"
                ))
            else:
                updated = False
                if not user.email:
                    user.email = email
                    updated = True
                if hasattr(user, "status") and user.status != "active":
                    user.status = "active"
                    updated = True
                if updated:
                    db.commit()
        db.commit()
        print("[Epicast] [OK] Default users seeded")
    finally:
        db.close()


def _sync_alerts_on_startup():
    """Re-derive all active alerts from current reports. Runs at every boot."""
    from utils import refresh_area_alerts
    db = SessionLocal()
    try:
        refresh_area_alerts(db)
        from models import Alert
        active = db.query(Alert).filter(Alert.status == "active").count()
        print(f"[Epicast] [OK] Alert sync complete - {active} active alert(s) from reports")
    except Exception as e:
        print(f"[Epicast] [WARNING] Alert sync failed at startup: {e}")
    finally:
        db.close()


def _seed_hyderabad_data():
    from models import Report
    from utils import _now, refresh_area_alerts, AREA_PROFILE
    from datetime import datetime, timedelta, timezone
    import random

    db = SessionLocal()
    try:
        if db.query(Report).count() > 0:
            return

        random.seed(42)

        clinics = [
            # (area_id, area_name, clinic_name, lat, lon)
            ("HYD-GACHI","Gachibowli",   "AIG Hospital",              17.4400,78.3489),
            ("HYD-GACHI","Gachibowli",   "Continental Hospital",       17.4338,78.3536),
            ("HYD-GACHI","Gachibowli",   "Medicover Clinic",           17.4450,78.3520),
            ("HYD-JUBIL","Jubilee Hills","Apollo Hospital",             17.4239,78.4071),
            ("HYD-JUBIL","Jubilee Hills","Rainbow Hospital",            17.4300,78.4100),
            ("HYD-JUBIL","Jubilee Hills","Olive Clinic",                17.4200,78.4130),
            ("HYD-BANJA","Banjara Hills","Care Hospitals",              17.4126,78.4482),
            ("HYD-BANJA","Banjara Hills","Ankura Hospital",             17.4160,78.4440),
            ("HYD-BANJA","Banjara Hills","MaxCure Hospital",            17.4180,78.4500),
            ("HYD-HTECH","Hitech City",  "Yashoda Hitech",             17.4486,78.3908),
            ("HYD-HTECH","Hitech City",  "Shalini Hospital",           17.4510,78.3950),
            ("HYD-HTECH","Hitech City",  "Primus Clinic",              17.4460,78.3870),
            ("HYD-MADHA","Madhapur",     "Seven Hills Hospital",        17.4525,78.3913),
            ("HYD-MADHA","Madhapur",     "Madhava Clinic",             17.4550,78.3940),
            ("HYD-MADHA","Madhapur",     "Lotus Healthcare",           17.4480,78.3920),
            ("HYD-KUKAT","Kukatpally",   "KIMS Hospital",              17.4849,78.4138),
            ("HYD-KUKAT","Kukatpally",   "Mediwin Hospital",           17.4870,78.4160),
            ("HYD-KUKAT","Kukatpally",   "SunCare Clinic",             17.4820,78.4120),
            ("HYD-SECUN","Secunderabad", "Yashoda Hospital",           17.4399,78.4983),
            ("HYD-SECUN","Secunderabad", "Sunshine Hospital",          17.4420,78.5000),
            ("HYD-SECUN","Secunderabad", "Care Clinic",                17.4370,78.4960),
            ("HYD-AMEER","Ameerpet",     "Vijaya Hospital",            17.4375,78.4483),
            ("HYD-AMEER","Ameerpet",     "Vaibhav Clinic",             17.4395,78.4510),
            ("HYD-AMEER","Ameerpet",     "Ameerpet Health Centre",     17.4360,78.4460),
            ("HYD-LBNGA","LB Nagar",     "Rajeev Gandhi Hospital",     17.3472,78.5511),
            ("HYD-LBNGA","LB Nagar",     "Sparsh Hospital",            17.3490,78.5530),
            ("HYD-LBNGA","LB Nagar",     "LB General Clinic",          17.3450,78.5490),
            ("HYD-UPPAL","Uppal",        "Uppal General Hospital",     17.4055,78.5592),
            ("HYD-UPPAL","Uppal",        "City Care Clinic",           17.4070,78.5610),
            ("HYD-UPPAL","Uppal",        "Medicity Hospital",          17.4040,78.5570),
            ("HYD-KONDA","Kondapur",     "Aware Gleneagles Hospital",  17.4600,78.3724),
            ("HYD-KONDA","Kondapur",     "Kondapur Health Clinic",     17.4620,78.3750),
            ("HYD-KONDA","Kondapur",     "Synergy Hospitals",          17.4580,78.3700),
            ("HYD-MIYAP","Miyapur",      "Citizens Specialty Hospital",17.4963,78.3553),
            ("HYD-MIYAP","Miyapur",      "Miyapur Clinic",             17.4980,78.3570),
            ("HYD-MIYAP","Miyapur",      "Amrutha Hospital",           17.4940,78.3530),
            ("HYD-BEGUM","Begumpet",     "NIMS",                       17.4350,78.4651),
            ("HYD-BEGUM","Begumpet",     "Begumpet Health Centre",     17.4370,78.4670),
            ("HYD-BEGUM","Begumpet",     "Sterling Hospital",          17.4330,78.4630),
            ("HYD-TARNA","Tarnaka",      "Tarnaka Area Hospital",      17.4289,78.5424),
            ("HYD-TARNA","Tarnaka",      "St. Theresa's Clinic",       17.4310,78.5440),
            ("HYD-TARNA","Tarnaka",      "Osmania General Hospital",   17.3888,78.4771),
            ("HYD-CHARM","Charminar",    "Government General Hospital",17.3800,78.4741),
            ("HYD-CHARM","Charminar",    "Charminar Clinic",           17.3610,78.4720),
            ("HYD-CHARM","Charminar",    "Al-Shifa Hospital",          17.3580,78.4700),
        ]

        # Primary disease per area — realistic dominant diseases
        area_disease_map = {
            "HYD-GACHI": ["Dengue", "Influenza"],
            "HYD-JUBIL": ["Influenza"],
            "HYD-BANJA": ["Dengue"],
            "HYD-HTECH": ["Influenza", "COVID-19"],
            "HYD-MADHA": ["Dengue", "COVID-19"],
            "HYD-KUKAT": ["Dengue", "Cholera"],
            "HYD-SECUN": ["Malaria", "Typhoid"],
            "HYD-AMEER": ["Dengue", "Typhoid"],
            "HYD-LBNGA": ["Cholera", "Dengue"],
            "HYD-UPPAL": ["Dengue", "Malaria"],
            "HYD-KONDA": ["Influenza"],
            "HYD-MIYAP": ["Dengue"],
            "HYD-BEGUM": ["COVID-19", "Influenza"],
            "HYD-TARNA": ["Malaria", "Dengue"],
            "HYD-CHARM": ["Cholera", "Typhoid"],
        }

        now = datetime.now(timezone.utc)

        # Epidemiological scenarios (cases per 100k population)
        # → GREEN <15/100k | YELLOW 15-50/100k | RED >80/100k
        area_scenario = {
            # ── GREEN zones (~65%) ──────────────────────────────────────────
            "HYD-GACHI": {"target_per_100k": 8,   "jitter": 4},
            "HYD-JUBIL": {"target_per_100k": 5,   "jitter": 3},
            "HYD-BANJA": {"target_per_100k": 6,   "jitter": 3},
            "HYD-HTECH": {"target_per_100k": 9,   "jitter": 4},
            "HYD-KONDA": {"target_per_100k": 7,   "jitter": 4},
            "HYD-MIYAP": {"target_per_100k": 11,  "jitter": 4},
            "HYD-BEGUM": {"target_per_100k": 13,  "jitter": 5},
            # ── YELLOW zones (~25%) ─────────────────────────────────────────
            "HYD-MADHA": {"target_per_100k": 22,  "jitter": 8},
            "HYD-SECUN": {"target_per_100k": 28,  "jitter": 9},
            "HYD-UPPAL": {"target_per_100k": 32,  "jitter": 10},
            "HYD-TARNA": {"target_per_100k": 35,  "jitter": 10},
            # ── RED zones (~10%) ────────────────────────────────────────────
            "HYD-KUKAT": {"target_per_100k": 85,  "jitter": 20},
            "HYD-AMEER": {"target_per_100k": 90,  "jitter": 18},
            "HYD-LBNGA": {"target_per_100k": 78,  "jitter": 15},
            "HYD-CHARM": {"target_per_100k": 120, "jitter": 25},
        }

        for i, (area_id, area_name, clinic_name, lat, lon) in enumerate(clinics):
            profile      = AREA_PROFILE.get(area_id, {"population": 300_000})
            pop          = profile["population"]
            scenario     = area_scenario.get(area_id, {"target_per_100k": 10, "jitter": 5})
            diseases     = area_disease_map.get(area_id, ["Dengue"])
            disease      = diseases[i % len(diseases)]

            # cases_per_clinic = (incidence_rate × population) / 3 clinics per area
            base_cases   = max(1, int((scenario["target_per_100k"] / 100_000) * pop / 3))
            jitter_range = max(1, int((scenario["jitter"] / 100_000) * pop / 3))

            for day_offset in range(0, 14, 3):
                ts    = (now - timedelta(days=day_offset)).isoformat()
                decay = 1.0 - (day_offset / 28)   # mild temporal decay
                cases = max(1, int(
                    (base_cases + random.randint(-jitter_range, jitter_range)) * decay
                ))
                # Disease-specific CFR
                cfr    = {"Cholera": 0.008, "Dengue": 0.003, "Malaria": 0.005}.get(disease, 0.002)
                deaths = max(0, int(cases * cfr * random.uniform(0.5, 1.5)))
                db.add(Report(
                    area_id=area_id, area_name=area_name, clinic_name=clinic_name,
                    latitude=lat, longitude=lon, disease_name=disease,
                    case_count=cases, death_count=deaths, timestamp=ts,
                ))

        db.commit()
        refresh_area_alerts(db)

        total = db.query(Report).count()
        print(f"[Epicast] [OK] Population-calibrated data seeded - {total} reports")
        print(f"[Epicast]   Expected distribution: ~65% GREEN | ~25% YELLOW | ~10% RED")
    finally:
        db.close()


@app.get("/health", tags=["Health"])
async def health():
    """Railway/cloud health-check probe."""
    return {"status": "ok"}


# Serve static files if they exist (Vite build)
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "../frontend/dist"))
if os.path.exists(frontend_dist):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist, "assets")), name="assets")

    # Root "/" serves React app if built, otherwise JSON status
    @app.get("/", tags=["Static Files"])
    async def root():
        index_html = os.path.join(frontend_dist, "index.html")
        if os.path.exists(index_html):
            return FileResponse(index_html)
        return {"status": "ok", "app": "Epicast", "version": "3.0.0", "focus": "Hyderabad"}

    # Fallback to serve index.html for React router
    @app.get("/{fallback_path:path}", tags=["Static Files"])
    async def fallback(fallback_path: str):
        file_path = os.path.join(frontend_dist, fallback_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(frontend_dist, "index.html"))
else:
    @app.get("/", tags=["Health"])
    async def root():
        return {"status": "ok", "app": "Epicast", "version": "3.0.0", "focus": "Hyderabad"}

