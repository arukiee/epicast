# 🦠 EPICAST — COMPLETE RECONSTRUCTION PROMPT

> **Use this prompt to rebuild the entire Epicast project from scratch.** Paste this into an AI coding assistant and it will have all the details needed to regenerate every file.

---

## OVERVIEW

Build **Epicast v3.0.0** — a production-style full-stack **Disease Outbreak Intelligence & Forecasting System** focused on **Hyderabad, India**. It monitors **15 geographic areas** with **45 clinics** (3 per area), tracks **7 communicable diseases**, computes **multi-factor risk scores**, classifies areas into **RED/YELLOW/GREEN outbreak zones**, generates **automated alerts**, and produces **7-day ML forecasts**.

**Tech Stack:**
- **Backend:** Python FastAPI + SQLAlchemy (SQLite) + scikit-learn + bcrypt + python-jose (JWT)
- **Frontend:** React 18 + Vite 5 + Tailwind CSS 3.4 + Leaflet.js + Chart.js + Axios + Framer Motion + Lucide React
- **Fonts:** Inter (UI) + JetBrains Mono (data) via Google Fonts

---

## PROJECT STRUCTURE

```
epicast/
├── .gitignore
├── README.md
├── render.yaml
├── backend/
│   ├── .env.example
│   ├── requirements.txt
│   ├── main.py                    ← FastAPI app, startup, seeding, CORS, middleware
│   ├── database.py                ← SQLAlchemy engine + session
│   ├── models.py                  ← 9 ORM models
│   ├── auth.py                    ← JWT, bcrypt, RBAC, rate limiting
│   ├── utils.py                   ← Haversine, risk scoring, alert engine, zone classification
│   ├── email_service.py           ← Resend + SMTP + console email
│   ├── email_validation.py        ← DNS/MX email validation
│   ├── token_utils.py             ← Bcrypt token hashing
│   ├── cache.py                   ← Optional Redis client
│   ├── tasks.py                   ← Periodic cleanup daemon
│   └── routes/
│       ├── auth_routes.py         ← Auth, onboarding, user CRUD (~985 lines)
│       ├── report_routes.py       ← Case/death report submission
│       ├── dashboard_routes.py    ← Stats, zones, forecast
│       ├── alert_routes.py        ← Alert listing, acknowledge, sync
│       ├── log_routes.py          ← Admin audit logs
│       ├── weather_routes.py      ← Open-Meteo weather integration
│       └── intel_routes.py        ← Intelligence feed, insights, resource stress
│
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    ├── postcss.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx                ← BrowserRouter + route guards
        ├── api.js                 ← Axios instance + all API helpers
        ├── styles/index.css       ← Custom CSS + animations
        ├── constants/
        │   └── hyderabadUserForm.js
        ├── components/
        │   ├── Layout.jsx         ← Sidebar + navbar + role-based nav
        │   ├── StatCard.jsx       ← KPI card with animation
        │   ├── OutbreakMap.jsx    ← Leaflet map with risk markers
        │   └── ForecastChart.jsx  ← Chart.js dual-line chart
        └── pages/
            ├── LoginPage.jsx      ← Login + Request Access + Forgot Password modals
            ├── DashboardPage.jsx  ← Main surveillance dashboard
            ├── ReportsPage.jsx    ← Report form + historical table
            ├── ForecastPage.jsx   ← ML forecast UI
            ├── AlertsPage.jsx     ← Alert management
            ├── LogsPage.jsx       ← Admin audit trail
            ├── UsersPage.jsx      ← Admin user CRUD
            ├── AccessRequestsPage.jsx ← Multi-tab approval queue
            ├── VerifyEmailPage.jsx
            ├── SetupPasswordPage.jsx
            └── ResetPasswordPage.jsx
```

---

# BACKEND SPECIFICATION

## Dependencies (requirements.txt)
```
fastapi>=0.110.0
uvicorn>=0.29.0
starlette>=0.36.0
SQLAlchemy>=2.0.0
pydantic>=2.6.0
bcrypt>=4.0.1
python-jose>=3.3.0
httpx>=0.27.0
redis>=5.0.0
scikit-learn>=1.4.0
numpy>=2.0.0
scipy>=1.12.0
pandas>=2.2.0
email-validator>=2.0.0
dnspython>=2.8.0
python-dotenv>=1.0.0
cachetools>=7.0.0
cryptography>=48.0.0
```

## Environment Variables (.env.example)
```
DATABASE_URL=sqlite:///./epicast.db
EPICAST_SECRET_KEY=your-jwt-signing-secret-key-change-this
EPICAST_ENV=production
APP_PUBLIC_URL=https://your-frontend-domain.railway.app
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-gmail@gmail.com
SMTP_PASSWORD=your-16-char-app-password
SMTP_FROM=Epicast <your-gmail@gmail.com>
SMTP_TLS=True
SMTP_SSL=False
EMAIL_ALLOW_CONSOLE_FALLBACK=false
RESEND_API_KEY=
RESEND_FROM=Epicast <onboarding@resend.dev>
```

Additional env vars: `ADMIN_INITIAL_PASSWORD`, `CORS_ORIGINS`, `ACCESS_TOKEN_EXPIRE_MINUTES` (default 1440), `REFRESH_TOKEN_EXPIRE_DAYS` (default 7), `COOKIE_SECURE`, `REDIS_URL`, `EMAIL_FORCE_CONSOLE`, `EMAIL_DNS_TIMEOUT` (default 10).

---

## DATABASE MODELS (9 tables)

### Table: `users`
| Column | Type | Constraints |
|--------|------|-------------|
| id | Integer | PK, autoincrement |
| username | String | unique, not null, index |
| password | String | not null (bcrypt hashed) |
| role | String | default="clinic_staff" |
| assigned_clinic | String | default="" |
| assigned_area | String | default="" |
| full_name | String | default="" |
| email | String | default="" |
| mfa_enabled | Boolean | default=False |
| mfa_method | String | default="email" |
| last_login_at | String | default="" |
| status | String | default="active" |
| password_setup_token | String | nullable, index |
| password_setup_expires | String | nullable |
| password_reset_token | String | nullable, index |
| password_reset_expires | String | nullable |

Roles: `admin`, `hospital_staff`, `clinic_staff`, `public_health_officer`, `analyst`, `observer`

### Table: `device_sessions`
| Column | Type | Constraints |
|--------|------|-------------|
| id | Integer | PK |
| session_id | String | unique, not null, index |
| username | String | not null, index |
| device_name | String | default="Unknown device" |
| device_fingerprint | String | default="" |
| ip_address | String | default="" |
| user_agent | String | default="" |
| trusted | Boolean | default=False |
| created_at | String | not null |
| last_seen_at | String | not null |
| expires_at | String | not null |
| revoked | Boolean | default=False |

### Table: `refresh_tokens`
| Column | Type | Constraints |
|--------|------|-------------|
| id | Integer | PK |
| token_id | String | unique, not null, index |
| token_hash | String | not null |
| username | String | not null, index |
| device_session_id | Integer | FK→device_sessions.id, nullable |
| created_at | String | not null |
| expires_at | String | not null |
| revoked | Boolean | default=False |

### Table: `mfa_challenges`
| Column | Type | Constraints |
|--------|------|-------------|
| id | Integer | PK |
| challenge_id | String | unique, not null, index |
| username | String | not null, index |
| method | String | default="email" |
| code_hash | String | not null |
| created_at / expires_at | String | not null |
| used | Boolean | default=False |
| device_session_id | Integer | FK→device_sessions.id, nullable |

### Table: `reports`
| Column | Type | Constraints |
|--------|------|-------------|
| id | Integer | PK |
| area_id | String | not null, index |
| area_name | String | not null |
| clinic_name | String | not null, default="" |
| latitude | Float | not null |
| longitude | Float | not null |
| disease_name | String | not null, index |
| case_count | Integer | default=0 |
| death_count | Integer | default=0 |
| timestamp | String | not null |

### Table: `alerts`
| Column | Type | Constraints |
|--------|------|-------------|
| id | Integer | PK |
| area_id | String | not null |
| area_name | String | default="" |
| disease_name | String | not null |
| message | Text | not null |
| clinics_involved | Integer | default=1 |
| affected_clinics | String | default="" (comma-separated) |
| risk_level | String | default="YELLOW" |
| status | String | default="active" |
| timestamp | String | not null |

### Table: `activity_logs`
id (PK), username (String), action (String), timestamp (String)

### Table: `email_verification_codes`
id (PK), email (String, index), code_hash (String), created_at, expires_at, used (Boolean, default=False)

### Table: `access_requests`
id (PK), full_name, email (index), organization, use_case (Text), created_at, provisioned_username/role/clinic/area (all default=""), provisioned_at, status (default="pending_approval"), verification_token (nullable, index), verification_expires (nullable)

---

## AREA PROFILES (15 Hyderabad Areas)

```python
AREA_PROFILE = {
    "HYD-KUKAT": {"population":1_300_000, "density":18_500, "area_sqkm":70, "mobility_hub":True,  "baseline_burden":0.72, "name":"Kukatpally"},
    "HYD-MADHA": {"population":450_000,   "density":15_200, "area_sqkm":30, "mobility_hub":True,  "baseline_burden":0.60, "name":"Madhapur"},
    "HYD-AMEER": {"population":320_000,   "density":22_000, "area_sqkm":15, "mobility_hub":True,  "baseline_burden":0.68, "name":"Ameerpet"},
    "HYD-LBNGA": {"population":980_000,   "density":19_000, "area_sqkm":52, "mobility_hub":False, "baseline_burden":0.75, "name":"LB Nagar"},
    "HYD-SECUN": {"population":1_100_000, "density":16_800, "area_sqkm":65, "mobility_hub":True,  "baseline_burden":0.62, "name":"Secunderabad"},
    "HYD-CHARM": {"population":750_000,   "density":28_000, "area_sqkm":27, "mobility_hub":False, "baseline_burden":0.85, "name":"Charminar"},
    "HYD-GACHI": {"population":480_000,   "density":8_200,  "area_sqkm":58, "mobility_hub":True,  "baseline_burden":0.42, "name":"Gachibowli"},
    "HYD-JUBIL": {"population":210_000,   "density":6_400,  "area_sqkm":33, "mobility_hub":False, "baseline_burden":0.38, "name":"Jubilee Hills"},
    "HYD-BANJA": {"population":195_000,   "density":5_800,  "area_sqkm":34, "mobility_hub":False, "baseline_burden":0.35, "name":"Banjara Hills"},
    "HYD-HTECH": {"population":390_000,   "density":9_100,  "area_sqkm":43, "mobility_hub":True,  "baseline_burden":0.44, "name":"Hitech City"},
    "HYD-UPPAL": {"population":620_000,   "density":14_200, "area_sqkm":44, "mobility_hub":False, "baseline_burden":0.70, "name":"Uppal"},
    "HYD-KONDA": {"population":280_000,   "density":7_500,  "area_sqkm":37, "mobility_hub":False, "baseline_burden":0.45, "name":"Kondapur"},
    "HYD-MIYAP": {"population":350_000,   "density":10_200, "area_sqkm":34, "mobility_hub":False, "baseline_burden":0.52, "name":"Miyapur"},
    "HYD-BEGUM": {"population":290_000,   "density":11_400, "area_sqkm":25, "mobility_hub":True,  "baseline_burden":0.55, "name":"Begumpet"},
    "HYD-TARNA": {"population":410_000,   "density":13_500, "area_sqkm":30, "mobility_hub":False, "baseline_burden":0.65, "name":"Tarnaka"},
}
```

Default (unknown area): `{population: 300_000, density: 9_000, area_sqkm: 35, mobility_hub: False, baseline_burden: 0.50}`

---

## 45 CLINICS (3 per area) with Exact Coordinates

```
HYD-GACHI  Gachibowli:    AIG Hospital (17.4400,78.3489), Continental Hospital (17.4338,78.3536), Medicover Clinic (17.4450,78.3520)
HYD-JUBIL  Jubilee Hills: Apollo Hospital (17.4239,78.4071), Rainbow Hospital (17.4300,78.4100), Olive Clinic (17.4200,78.4130)
HYD-BANJA  Banjara Hills: Care Hospitals (17.4126,78.4482), Ankura Hospital (17.4160,78.4440), MaxCure Hospital (17.4180,78.4500)
HYD-HTECH  Hitech City:   Yashoda Hitech (17.4486,78.3908), Shalini Hospital (17.4510,78.3950), Primus Clinic (17.4460,78.3870)
HYD-MADHA  Madhapur:      Seven Hills Hospital (17.4525,78.3913), Madhava Clinic (17.4550,78.3940), Lotus Healthcare (17.4480,78.3920)
HYD-KUKAT  Kukatpally:    KIMS Hospital (17.4849,78.4138), Mediwin Hospital (17.4870,78.4160), SunCare Clinic (17.4820,78.4120)
HYD-SECUN  Secunderabad:  Yashoda Hospital (17.4399,78.4983), Sunshine Hospital (17.4420,78.5000), Care Clinic (17.4370,78.4960)
HYD-AMEER  Ameerpet:      Vijaya Hospital (17.4375,78.4483), Vaibhav Clinic (17.4395,78.4510), Ameerpet Health Centre (17.4360,78.4460)
HYD-LBNGA  LB Nagar:      Rajeev Gandhi Hospital (17.3472,78.5511), Sparsh Hospital (17.3490,78.5530), LB General Clinic (17.3450,78.5490)
HYD-UPPAL  Uppal:         Uppal General Hospital (17.4055,78.5592), City Care Clinic (17.4070,78.5610), Medicity Hospital (17.4040,78.5570)
HYD-KONDA  Kondapur:      Aware Gleneagles Hospital (17.4600,78.3724), Kondapur Health Clinic (17.4620,78.3750), Synergy Hospitals (17.4580,78.3700)
HYD-MIYAP  Miyapur:       Citizens Specialty Hospital (17.4963,78.3553), Miyapur Clinic (17.4980,78.3570), Amrutha Hospital (17.4940,78.3530)
HYD-BEGUM  Begumpet:      NIMS (17.4350,78.4651), Begumpet Health Centre (17.4370,78.4670), Sterling Hospital (17.4330,78.4630)
HYD-TARNA  Tarnaka:       Tarnaka Area Hospital (17.4289,78.5424), St. Theresa's Clinic (17.4310,78.5440), Osmania General Hospital (17.3888,78.4771)
HYD-CHARM  Charminar:     Government General Hospital (17.3800,78.4741), Charminar Clinic (17.3610,78.4720), Al-Shifa Hospital (17.3580,78.4700)
```

---

## DISEASE CONFIGURATION

**Tracked Diseases:** Dengue, Cholera, Malaria, COVID-19, Typhoid, Influenza, Leptospirosis (backend: 7), + Hepatitis A (frontend report form: 8)

**Severity Multipliers:**
```python
{"dengue":1.20, "cholera":1.45, "malaria":1.15, "covid-19":1.30, "typhoid":1.10, "influenza":0.85, "leptospirosis":1.35}
```

**Disease-to-Area Seeding Map:**
```python
{"HYD-GACHI":["Dengue","Influenza"], "HYD-JUBIL":["Influenza"], "HYD-BANJA":["Dengue"],
 "HYD-HTECH":["Influenza","COVID-19"], "HYD-MADHA":["Dengue","COVID-19"],
 "HYD-KUKAT":["Dengue","Cholera"], "HYD-SECUN":["Malaria","Typhoid"],
 "HYD-AMEER":["Dengue","Typhoid"], "HYD-LBNGA":["Cholera","Dengue"],
 "HYD-UPPAL":["Dengue","Malaria"], "HYD-KONDA":["Influenza"], "HYD-MIYAP":["Dengue"],
 "HYD-BEGUM":["COVID-19","Influenza"], "HYD-TARNA":["Malaria","Dengue"],
 "HYD-CHARM":["Cholera","Typhoid"]}
```

**Disease-specific CFR for seeding:** `{"Cholera":0.008, "Dengue":0.003, "Malaria":0.005, default:0.002}`

---

## CORE ALGORITHMS

### 1. Haversine Distance
```python
def haversine_km(lat1, lon1, lat2, lon2):
    R = 6371.0  # Earth radius in km
    # Standard haversine formula
```

### 2. Multi-Factor Risk Scoring (0-100)

**6 weighted factors (sum = 1.0):**

| Factor | Weight | Formula |
|--------|--------|---------|
| Incidence | 0.30 | `(cases / population × 100_000) / 200 × 100`, capped at 100 |
| Growth | 0.20 | `(CFR / 0.02) × 100`, capped 100; ×1.15 if mobility_hub |
| Severity | 0.15 | `(avg_disease_severity - 0.8) / 0.7 × 100` |
| Hospital Stress | 0.15 | `cases / (density × area_sqkm × 0.003) × 100` |
| Neighbor Spread | 0.10 | Sum of nearby (within 8km) area influences: `(1 - dist/8) × other_incidence × 0.4` |
| Density Vulnerability | 0.10 | `(1 - (density - 5000) / 20000) × 100` (sparse = more vulnerable) |

**Low-incidence cap:** If incidence_score < 5.0 → growth capped at 15, hospital capped at 20
**Burden multiplier:** `0.85 + baseline_burden × 0.30` (range 0.85–1.155)
**Final:** `min(100, raw_score × burden_multiplier)`

**Zone Thresholds:** GREEN < 40, YELLOW 40–69, RED ≥ 70
**Two-pass algorithm:** Pass 1 = raw data aggregation, Pass 2 = neighbor-aware scoring

### 3. Alert Classification
- **RED:** incidence ≥ 50/100k OR risk_score ≥ 70
- **YELLOW:** incidence ≥ 15/100k OR risk_score ≥ 40 OR ≥ 2 clinics reporting same disease
- **Growth Trend:** Compares last 7 days vs prior 7 days → >20% = "Increasing", <-20% = "Decreasing", else "Stable", no data = "Insufficient data", no prior = "New cluster"
- **Alert message format:** `{emoji} {disease} cluster — {area}. {N} clinic(s): {names}. {cases} case(s) · {deaths} death(s). Incidence: X/100k. Risk score: X/100. Trend: X.`
- **Deduplication:** One active alert per (area_id, disease_name), updated in-place

### 4. ML Forecasting (Linear Regression)
- **Model:** `sklearn.linear_model.LinearRegression`
- **Training:** Last 14 days of daily case counts for selected disease
- **Prediction:** Next 7 days, values clamped ≥ 0
- **Output:** historical + forecast data, R² score, clinic count
- **Guard:** Returns 404 if no data or all zeros

### 5. Data Seeding Algorithm
- `random.seed(42)` for reproducibility
- Per clinic: `base_cases = max(1, int((target_per_100k / 100_000) × population / 3))`
- 5 reports per clinic: day_offset in `[0, 3, 6, 9, 12]`
- Temporal decay: `1.0 - (day_offset / 28)`
- Target zone distribution: ~65% GREEN, ~25% YELLOW, ~10% RED

---

## AUTHENTICATION & SECURITY

- **JWT:** Algorithm HS512, access token 24hr, refresh token 7 days with rotation
- **Passwords:** bcrypt with auto-generated salt
- **Refresh tokens:** Stored as bcrypt hashes, sent via httpOnly strict-SameSite cookie
- **Rate limiting:** 6 attempts per 60s per IP+path (production only), Redis-backed with in-memory fallback
- **Security headers:** `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `HSTS: 2yr + preload`, `Cache-Control: no-store`
- **Production check:** SECRET_KEY must be ≥32 chars and not default

**6 Roles with Permissions:**
```python
ROLE_PERMISSIONS = {
    "admin": ["manage_users", "view_audit", "manage_sessions", "submit_reports", "review_alerts"],
    "hospital_staff": ["view_reports", "submit_reports", "view_alerts"],
    "clinic_staff": ["view_reports", "submit_reports"],
    "public_health_officer": ["view_reports", "view_alerts"],
    "analyst": ["view_reports", "view_forecasts", "view_alerts"],
    "observer": ["view_reports"],
}
```

**Clinic-level access:** `clinic_staff` can only submit for assigned clinic; `hospital_staff` see reports for assigned area.

---

## EMAIL SERVICE

**Priority cascade:** Resend (production) → SMTP → Resend (test) → Console fallback
- **Resend API:** POST `https://api.resend.com/emails`, timeout 15s
- **SMTP:** supports TLS/SSL, Gmail app passwords (spaces auto-stripped)
- **Templates:** Verification (24hr), Password Reset (1hr), Account Approval — all with styled HTML emails

---

## API ENDPOINTS

### Auth & Onboarding
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /login | rate-limited | Login, creates DeviceSession + RefreshToken |
| POST | /refresh | cookie | Rotate refresh token |
| POST | /logout | authenticated | Revoke session |
| GET | /me | authenticated | Current user info |
| GET | /auth/roles | none | Role previews |
| POST | /request-demo | rate-limited | Submit access request |
| GET | /request-demo/check-email | none | Email availability check |
| GET | /email/validate | none | DNS/MX validation |
| POST | /auth/verify-email | none | Verify email token → create user |
| POST | /auth/setup-password | none | Set password (3-day token) |
| POST | /auth/forgot-password | rate-limited | Generate reset token (1hr) |
| POST | /auth/reset-password | none | Reset password |
| GET | /auth/sessions | authenticated | List device sessions |

### Admin
| Method | Path | Description |
|--------|------|-------------|
| GET | /admin/access-requests | List all requests |
| POST | /admin/access-requests/{id}/approve | Approve + send verification email |
| POST | /admin/access-requests/{id}/reject | Reject request |
| GET/POST/PATCH/DELETE | /admin/users[/{id}] | Full user CRUD |

### Reports
| Method | Path | Description |
|--------|------|-------------|
| POST | /report_case | Submit case report (max 100,000) |
| POST | /report_death | Submit death report (max 500, ≤ cases) |
| GET | /reports | List reports (role-filtered) |

Reports **merge** same-day entries by `(area_id, clinic_name, disease_name)`.

### Dashboard & Forecast
| Method | Path | Description |
|--------|------|-------------|
| GET | /dashboard/stats | KPI summary |
| GET | /dashboard/zones | Area zones with filters (area, disease, zone) |
| GET | /dashboard/areas | Area summaries sorted by zone |
| GET | /dashboard/forecast/{disease} | 7-day Linear Regression forecast |
| GET | /dashboard/alerts | All alerts sorted by severity |
| POST | /alerts/{id}/acknowledge | Acknowledge alert |
| POST | /alerts/sync | Admin: force re-derive alerts |
| GET | /logs | Admin: last 500 activity logs |

### Weather & Intelligence
| Method | Path | Description |
|--------|------|-------------|
| GET | /weather/current | Open-Meteo weather (30min cache) |
| GET | /intel/feed | Alert-based event feed |
| GET | /intel/news | 4 static reference articles |
| GET | /intel/ai-insights | 5 data-derived observations |
| GET | /intel/resource-stress | Hospital bed utilization estimates |

---

## BACKGROUND TASKS

**Cleanup daemon** (`tasks.py`): Runs every 10 minutes (600s). Expires `pending_verification` access requests past 24hr. Clears expired password setup tokens.

---

# FRONTEND SPECIFICATION

## Dependencies (package.json)
```json
{
  "react": "^18.2.0", "react-dom": "^18.2.0", "react-router-dom": "^6.22.3",
  "leaflet": "^1.9.4", "chart.js": "^4.4.2", "react-chartjs-2": "^5.2.0",
  "recharts": "^2.12.7", "axios": "^1.6.8",
  "lucide-react": "^0.358.0", "framer-motion": "^10.16.16"
}
```
Dev: `@vitejs/plugin-react ^4.2.1`, `tailwindcss ^3.4.3`, `vite ^5.2.6`, `autoprefixer`, `postcss`

## Vite Config
- Port 5173, `allowedHosts: true`
- Proxy: `/api` → `http://localhost:8000`, strips `/api` prefix

## Tailwind Config
- Content: `['./index.html', './src/**/*.{js,jsx,ts,tsx}']`
- Custom `brand` color palette (indigo-based: 50 `#eef2ff` → 900 `#312e81`)
- Font: `sans: ['Inter', 'system-ui', 'sans-serif']`

## index.html
- Title: `Epicast — Disease Outbreak Intelligence`
- Loads Leaflet CSS from CDN: `unpkg.com/leaflet@1.9.4/dist/leaflet.css`
- Google Fonts: Inter (300–800) + JetBrains Mono (400–600)

---

## DESIGN SYSTEM (index.css)

**Card Classes:**
- `.glass` — white bg, 1px gray border, subtle shadow, rounded-2xl
- `.glass-bright` — stronger border + shadow

**Badge Classes:** `.badge-red`, `.badge-yellow`, `.badge-green`, `.badge-purple`, `.badge-blue` — bg/text/border combos with rounded-full

**Severity Pills:** `.severity-HIGH` (red), `.severity-MODERATE` (amber), `.severity-LOW` (green), `.severity-CRITICAL` (red-100)

**Buttons:** `.btn-primary` (black bg, white text), `.btn-secondary` (gray-100 bg, gray-700 text)

**Inputs:** `.input-base` — gray-50 bg, gray-200 border, focus:ring-2 ring-black

**Animations (6 keyframes):**
1. `fadeIn` — opacity 0→1, translateY 8px→0, 0.35s
2. `pulse-slow` — opacity pulse, 3s infinite
3. `pulseRing` — scale 1→2.2, opacity 0.7→0, 2s (RED zone markers)
4. `liveDot` — green dot pulse with box-shadow, 2s
5. `countUp` — opacity + translateY, 0.5s
6. `progressFill` — width 0→var(--target-width), 1.2s

**Leaflet popup overrides:** white bg, gray border, 14px rounded, shadow

**Custom scrollbar:** 5px width, gray-100 track, gray-300 thumb

---

## ROUTING & GUARDS (App.jsx)

- **ProtectedRoute:** Checks `localStorage.getItem('epicast_token')`
- **AdminRoute:** Checks `user.role === 'admin'`
- **ReporterRoute:** Blocks `public_health_officer` from reports

| Path | Component | Guard |
|------|-----------|-------|
| `/login` | LoginPage | Public |
| `/verify-email` | VerifyEmailPage | Public |
| `/setup-password` | SetupPasswordPage | Public |
| `/reset-password` | ResetPasswordPage | Public |
| `/dashboard` | DashboardPage | Protected |
| `/reports` | ReportsPage | Protected + Reporter |
| `/forecast` | ForecastPage | Protected |
| `/alerts` | AlertsPage | Protected |
| `/logs` | LogsPage | Protected + Admin |
| `/users` | UsersPage | Protected + Admin |
| `/access-requests` | AccessRequestsPage | Protected + Admin |

---

## API MODULE (api.js)

- Axios instance: baseURL from `VITE_API_URL` env or `http://localhost:8000`, timeout 30s
- **Request interceptor:** Attaches `Bearer` token, skips for public auth paths
- **Response interceptor:** On 401 → clear localStorage, redirect to `/login`
- **Refresh logic:** Shared promise deduplication across concurrent callers
- Token stored as `epicast_token`, user as `epicast_user` in localStorage

---

## KEY PAGES

### LoginPage
- Full-screen black bg with radial dot grid pattern
- White card with logo, email/password form, show/hide password toggle
- **Request Access modal:** full_name, email (with real-time DNS/MX validation, 450ms debounce), organization, use_case
- **Forgot Password modal:** identifier field
- Auto-redirect if valid token exists (validates via `/dashboard/stats`)
- Version text: "EPICAST v4.0"

### DashboardPage
- 6 KPI stat cards, 3 filter selects (area/disease/zone), outbreak map + alerts sidebar
- Auto-refreshes every 60 seconds
- Surveillance observations from `/intel/ai-insights`
- Area-wise risk grid sorted by risk_score descending
- Areas list: `['Gachibowli','Jubilee Hills','Banjara Hills','Hitech City','Madhapur','Kukatpally','Secunderabad','Ameerpet','LB Nagar','Uppal','Kondapur','Miyapur','Begumpet','Tarnaka','Charminar']`

### OutbreakMap (Leaflet)
- Center: `[17.385, 78.4867]`, zoom 12
- Tiles: CARTO dark (`https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png`)
- Circle markers: radius from population (195k→10px, 1.3M→28px), color by zone, opacity by risk_score
- RED zones get 2 animated pulse rings
- Rich HTML popups: area name, population, zone label, metrics grid, risk score bar, score breakdown (6 factors with specific colors), disease pills, clinic list, mobility hub flag
- Legend: RED ≥70, YELLOW 40–69, GREEN <40

### ForecastChart (Chart.js)
- Two datasets: Historical (solid indigo `#6366f1`, filled) + Forecast (dashed amber `#f59e0b`, filled)
- Dark tooltips (`#1e293b`), 320px height, tension 0.4

### ReportsPage
- Toggle between Case/Death report
- 45 clinics grouped by area in select
- 8 diseases in select
- Validation: future dates blocked, deaths ≤ cases, max limits
- Paginated table (50 per page)

### AlertsPage
- 4 stat cards, filter tabs (all/active/acknowledged)
- Alert cards with parsed metrics (trend, incidence, risk score, cases) from message text via regex
- Admin sync button

### Layout
- Desktop: fixed 240px white sidebar with border-right
- Mobile: animated slide-in drawer (framer-motion spring)
- Logo: "EPICAST" with "Hyderabad · Disease Surveillance"
- Nav split: Surveillance (Dashboard, Reports, Forecast, Alerts) + Administration (Users, Access Requests, Activity Logs)
- Top bar: green "Surveillance Active" dot, live clock (IST, updates every second), role badge, date
- Active nav: black bg white text; inactive: gray with hover

### Role Badge Colors
| Role | Classes |
|------|---------|
| admin | `bg-red-50 text-red-700 border-red-200` |
| hospital_staff | `bg-blue-50 text-blue-700 border-blue-200` |
| clinic_staff | `bg-violet-50 text-violet-700 border-violet-200` |
| public_health_officer | `bg-green-50 text-green-700 border-green-200` |

### Log Action Colors
LOGIN=green, LOGOUT=gray, REPORT=blue, ALERT=amber, FORECAST=purple, DASHBOARD=sky

### Disease Pill Colors
Dengue=orange, Cholera=blue, Malaria=green, COVID-19=red, Typhoid=purple, Influenza=sky, Hepatitis A=amber, Leptospirosis=teal

---

## CONSTANTS FILE (hyderabadUserForm.js)

```javascript
PROVISION_ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'hospital_staff', label: 'Hospital Staff' },
  { value: 'clinic_staff', label: 'Clinic Staff' },
  { value: 'public_health_officer', label: 'Public Health Officer' },
]

HYD_AREAS = ['Gachibowli','Jubilee Hills','Banjara Hills','Hitech City','Madhapur',
  'Kukatpally','Secunderabad','Ameerpet','LB Nagar','Uppal',
  'Kondapur','Miyapur','Begumpet','Tarnaka','Charminar']

CLINICS_BY_AREA = { /* 15 areas × 3 clinics each */ }

suggestUsernameFromEmail(email) // takes part before @, lowercases, replaces non-alnum with _
suggestTemporaryPassword()     // 10 random chars + "Aa1" suffix
```

---

## DEPLOYMENT

### render.yaml
```yaml
services:
  - type: web
    name: epicast-backend
    runtime: python
    rootDir: backend
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn main:app --host 0.0.0.0 --port $PORT
    healthCheckPath: /health
```

### Health Endpoints
- `GET /` → `{"status":"ok", "app":"Epicast", "version":"3.0.0", "focus":"Hyderabad"}`
- `GET /health` → `{"status":"ok"}`
- `GET /health/email` → email provider diagnostics

### Default Admin
| Username | Password | Role |
|----------|----------|------|
| admin | admin123 | admin |

---

## STARTUP SEQUENCE

1. Validate production config (SECRET_KEY)
2. Create all database tables
3. Run SQLite column migrations
4. Seed admin user
5. Seed 45 clinics × 5 time points = ~225 reports with realistic zone distribution
6. Sync/rebuild alerts from reports
7. Log email configuration
8. Start background cleanup daemon (every 10 minutes)

---

> **End of reconstruction prompt.** This document contains every constant, algorithm, threshold, coordinate, color code, API endpoint, validation rule, and UI specification needed to rebuild the complete Epicast system.
