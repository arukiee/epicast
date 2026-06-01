# 🦠 Epicast — Disease Outbreak Intelligence & Forecasting System

A production-style full-stack healthcare intelligence platform for real-time outbreak monitoring, geospatial zone classification, automated alerts, and ML-powered disease spread forecasting.

---

## 📁 Project Structure

```
epicast/
├── backend/
│   ├── main.py                   ← FastAPI app entry point (startup, seeding, CORS, cleanup daemon)
│   ├── database.py               ← SQLAlchemy engine + session factory
│   ├── models.py                 ← ORM models: User, Report, Alert, ActivityLog, AccessRequest
│   ├── auth.py                   ← JWT creation/validation + password hashing
│   ├── email_service.py          ← Mail dispatcher supporting Resend & local console simulator
│   ├── tasks.py                  ← Periodic background cleanup task for expired tokens
│   ├── utils.py                  ← Haversine, compute_zone, ensure_alert, log_activity
│   ├── requirements.txt          ← Python dependencies (FastAPI, SQLAlchemy, scikit-learn, etc.)
│   ├── test_onboarding.py        ← Integration test suite for onboarding & activation workflows
│   └── routes/
│       ├── auth_routes.py        ← Auth routes: /login, /logout, /verify-email, /setup-password, /admin/access-requests/...
│       ├── report_routes.py      ← POST /report_case, POST /report_death, GET /reports
│       ├── dashboard_routes.py   ← GET /dashboard/{stats,zones,forecast/:disease}
│       ├── alert_routes.py       ← GET /dashboard/alerts, POST /alerts/:id/acknowledge
│       └── log_routes.py         ← GET /logs (admin only)
│
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    ├── postcss.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx               ← BrowserRouter + protected routes
        ├── api.js                ← Axios instance + all API helpers
        ├── styles/index.css
        ├── components/
        │   ├── Layout.jsx        ← Sidebar + navbar shell
        │   ├── StatCard.jsx      ← KPI card component
        │   ├── OutbreakMap.jsx   ← Leaflet map with zone markers
        │   └── ForecastChart.jsx ← Chart.js historical + forecast line chart
        └── pages/
            ├── LoginPage.jsx
            ├── DashboardPage.jsx
            ├── ReportsPage.jsx
            ├── ForecastPage.jsx
            ├── AlertsPage.jsx
            ├── LogsPage.jsx
            ├── AccessRequestsPage.jsx ← Redesigned admin inbox for pending requests review
            ├── VerifyEmailPage.jsx    ← Handles email token verification
            └── SetupPasswordPage.jsx  ← Secure user password initialization
```

---

## ⚙️ Prerequisites

| Tool    | Version |
|---------|---------|
| Python  | 3.10+   |
| Node.js | 18+     |
| npm     | 9+      |

---

## 🚀 Quick Start

### 1. Clone / extract the project

```bash
cd epicast
```

---

### 2. Backend Setup

1. Configure Environment:
   Create a `.env` file in the `backend/` directory (you can copy from `backend/.env.example`):
   ```env
   DATABASE_URL=sqlite:///./epicast.db
   SECRET_KEY=your-jwt-signing-secret-key-change-this
   # Optional: Configure Resend for outgoing emails. 
   # If left blank, Epicast defaults to an email simulator printing links in the console.
   RESEND_API_KEY=
   ```

2. Run Server:
   ```bash
   cd backend

   # Create virtual environment
   python -m venv venv

   # Activate (Linux / macOS)
   source venv/bin/activate

   # Activate (Windows PowerShell)
   .\venv\Scripts\Activate.ps1

   # Install dependencies
   pip install -r requirements.txt

   # Start the FastAPI server
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

The API will be live at **http://localhost:8000**

- Swagger docs: http://localhost:8000/docs
- ReDoc:        http://localhost:8000/redoc

On first run the server will:
1. Create `epicast.db` (SQLite)
2. Run database migrations and column checks
3. Seed default system users
4. Seed outbreak reports from Hyderabad areas
5. Start the periodic background expired token cleanup daemon

---

### 3. Frontend Setup

Open a **new terminal tab**:

```bash
cd frontend

# Install Node dependencies
npm install

# Start the Vite dev server
npm run dev
```

Frontend will be live at **http://localhost:5173**

---

## 🔑 Default Admin Login

| Username | Password | Role  |
|----------|----------|-------|
| admin    | admin123 | admin |

---

## 🌐 API Endpoints Summary

### Authentication & Onboarding
| Method | Endpoint                          | Description                                             |
|--------|-----------------------------------|---------------------------------------------------------|
| POST   | /request-demo                     | Public user submits access request                     |
| POST   | /login                            | Authenticate user $\rightarrow$ JWT (checks active status) |
| POST   | /logout                           | Terminate session (audit logged)                        |
| POST   | /auth/verify-email                | Validate verification token $\rightarrow$ returns setup_token |
| POST   | /auth/setup-password              | Configures user's password                              |

### Admin Request Management (Admin Only)
| Method | Endpoint                                 | Description                                        |
|--------|------------------------------------------|----------------------------------------------------|
| GET    | /admin/access-requests                   | List all user access requests                      |
| POST   | /admin/access-requests/{id}/approve      | Admin approves request & dispatches verification link |
| POST   | /admin/access-requests/{id}/reject       | Admin rejects request                              |

### Reports
| Method | Endpoint        | Description              |
|--------|-----------------|--------------------------|
| POST   | /report_case    | Submit case report       |
| POST   | /report_death   | Submit death report      |
| GET    | /reports        | List all reports         |

### Dashboard & Forecasting
| Method | Endpoint                         | Description              |
|--------|----------------------------------|--------------------------|
| GET    | /dashboard/stats                 | KPI summary cards        |
| GET    | /dashboard/zones                 | Geo zone map data        |
| GET    | /dashboard/alerts                | All outbreak alerts      |
| GET    | /dashboard/forecast/{disease}    | 7-day ML forecast        |

### Logs
| Method | Endpoint | Description              |
|--------|----------|--------------------------|
| GET    | /logs    | Admin-only audit trail   |

---

## 🧪 Testing

To run the integration tests checking the full user approval-verification onboarding workflow and background cleanup daemon:

```bash
cd backend
.\venv\Scripts\python.exe -m unittest test_onboarding.py
```

---

## 🧠 Technical Highlights

### Approval-Based Activation Workflow
To maximize security:
1. **Public Demo Request**: User submits request. Initial status is `pending_approval`. No email is sent.
2. **Admin Review**: Admin reviews request, configures their Username, Role, Area, and Clinic, and approves it. Request moves to `pending_verification`, triggering verification email dispatch.
3. **Verification**: User verifies email. Backend instantly provisions the `User` in the database, generates a `password_setup_token`, and passes it back.
4. **Password Setup**: User sets password using the setup token. Token is cleared, and account becomes fully active.

### Periodic Background Expiry Cleanup
- A self-contained async daemon (`backend/tasks.py`) runs natively in the FastAPI event loop.
- It scans the database periodically (every 10 minutes) to clear verification requests that failed to verify within 24 hours, and password setup links that expired.
- Actions are audit-logged in `activity_logs`.

### Outbreak Detection (Haversine Clustering)
- All reports within **5 km** of a new report with the **same disease** are clustered.
- `cluster_count ≥ 2` $\rightarrow$ **RED zone**
- `cluster_count ≥ 1` or `case_count > 1000` $\rightarrow$ **YELLOW zone**
- Otherwise $\rightarrow$ **GREEN zone**

### Forecasting (scikit-learn LinearRegression)
- Aggregates daily case counts over the last **14 days**.
- Fits `LinearRegression` on day index $\rightarrow$ case count and predicts the **next 7 days**.
- Returns `r2_score` as model quality indicator.

### Security
- Inputs validated for null/empty token inputs.
- Passwords hashed with **bcrypt** via `passlib`.
- **JWT** tokens signed with HS512. Token expiry: **12 hours**.
- Strict admin checks on sensitive endpoints.

---

## 🎨 UI Features

- Redesigned Admin Access Inbox with a tabbed interface separating **Pending Review**, **Awaiting Verification**, **Active Users**, and **Rejected Requests**.
- Premium dark glassmorphism system with improved color contrast on notice boxes and active items.
- Dynamic Leaflet outbreak mapping with status color borders and circles.
- Auto-refreshing dashboard metrics and toast alerts.
- Chart.js dual-line chart (historical solid + forecast dashed)
- Auto-refreshing dashboard (every 60 seconds)
- Toast notifications for form submissions

*Epicast v1.0 — Built as a production-style healthcare intelligence platform*
