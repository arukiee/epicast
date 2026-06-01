"""
utils.py — Epidemiologically realistic Hyderabad outbreak risk engine.

Risk = population-normalized weighted score across 7 factors.
Target zone distribution: ~65-75% GREEN, ~20-25% YELLOW, ~5-10% RED.
"""

import math
from collections import defaultdict
from datetime import datetime, timezone
from typing import List
from fastapi import Request
from sqlalchemy.orm import Session

from models import Report, Alert, ActivityLog

# ── Helpers ───────────────────────────────────────────────────────────────────

def haversine_km(lat1, lon1, lat2, lon2) -> float:
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi   = math.radians(lat2 - lat1)
    dlambda= math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))


def get_client_ip(request: Request) -> str:
    for header in ("x-forwarded-for", "x-real-ip"):
        if header in request.headers:
            return request.headers[header].split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


def get_device_fingerprint(request: Request) -> str:
    user_agent = request.headers.get("user-agent", "unknown")
    accept = request.headers.get("accept", "")
    return f"{user_agent}|{accept}"[:240]


def obfuscate_email(email: str) -> str:
    if "@" not in email:
        return email
    local, domain = email.split("@", 1)
    if len(local) <= 2:
        masked = "*" * len(local)
    else:
        masked = local[0] + "*" * (len(local) - 2) + local[-1]
    return f"{masked}@{domain}"


def log_activity(username: str, action: str, db: Session, meta: str = "") -> None:
    meta_text = f" | {meta}" if meta else ""
    db.add(ActivityLog(username=username, action=f"{action}{meta_text}", timestamp=_now()))
    db.commit()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Hyderabad Area Demographics ───────────────────────────────────────────────
# Source: Hyderabad Metropolitan Development Authority + Census 2011 projections
# population: estimated residents in the locality
# density_per_sqkm: approx persons per sq km
# mobility_hub: True → airport/IT/transport corridors boost spread probability
# baseline_disease_burden: 0.0–1.0, historical prevalence multiplier

AREA_PROFILE = {
    "HYD-KUKAT": {
        "population": 1_300_000, "density": 18_500, "area_sqkm": 70,
        "mobility_hub": True, "baseline_burden": 0.72,
        "name": "Kukatpally",
    },
    "HYD-MADHA": {
        "population": 450_000,  "density": 15_200, "area_sqkm": 30,
        "mobility_hub": True, "baseline_burden": 0.60,
        "name": "Madhapur",
    },
    "HYD-AMEER": {
        "population": 320_000,  "density": 22_000, "area_sqkm": 15,
        "mobility_hub": True, "baseline_burden": 0.68,
        "name": "Ameerpet",
    },
    "HYD-LBNGA": {
        "population": 980_000,  "density": 19_000, "area_sqkm": 52,
        "mobility_hub": False, "baseline_burden": 0.75,
        "name": "LB Nagar",
    },
    "HYD-SECUN": {
        "population": 1_100_000,"density": 16_800, "area_sqkm": 65,
        "mobility_hub": True, "baseline_burden": 0.62,
        "name": "Secunderabad",
    },
    "HYD-CHARM": {
        "population": 750_000,  "density": 28_000, "area_sqkm": 27,
        "mobility_hub": False, "baseline_burden": 0.85,
        "name": "Charminar",
    },
    "HYD-GACHI": {
        "population": 480_000,  "density": 8_200,  "area_sqkm": 58,
        "mobility_hub": True, "baseline_burden": 0.42,
        "name": "Gachibowli",
    },
    "HYD-JUBIL": {
        "population": 210_000,  "density": 6_400,  "area_sqkm": 33,
        "mobility_hub": False, "baseline_burden": 0.38,
        "name": "Jubilee Hills",
    },
    "HYD-BANJA": {
        "population": 195_000,  "density": 5_800,  "area_sqkm": 34,
        "mobility_hub": False, "baseline_burden": 0.35,
        "name": "Banjara Hills",
    },
    "HYD-HTECH": {
        "population": 390_000,  "density": 9_100,  "area_sqkm": 43,
        "mobility_hub": True, "baseline_burden": 0.44,
        "name": "Hitech City",
    },
    "HYD-UPPAL": {
        "population": 620_000,  "density": 14_200, "area_sqkm": 44,
        "mobility_hub": False, "baseline_burden": 0.70,
        "name": "Uppal",
    },
    "HYD-KONDA": {
        "population": 280_000,  "density": 7_500,  "area_sqkm": 37,
        "mobility_hub": False, "baseline_burden": 0.45,
        "name": "Kondapur",
    },
    "HYD-MIYAP": {
        "population": 350_000,  "density": 10_200, "area_sqkm": 34,
        "mobility_hub": False, "baseline_burden": 0.52,
        "name": "Miyapur",
    },
    "HYD-BEGUM": {
        "population": 290_000,  "density": 11_400, "area_sqkm": 25,
        "mobility_hub": True, "baseline_burden": 0.55,
        "name": "Begumpet",
    },
    "HYD-TARNA": {
        "population": 410_000,  "density": 13_500, "area_sqkm": 30,
        "mobility_hub": False, "baseline_burden": 0.65,
        "name": "Tarnaka",
    },
}

# Disease severity multipliers (higher = more dangerous at same case count)
DISEASE_SEVERITY = {
    "dengue":      1.20,
    "cholera":     1.45,
    "malaria":     1.15,
    "covid-19":    1.30,
    "typhoid":     1.10,
    "influenza":   0.85,
    "leptospirosis":1.35,
}

NEIGHBOR_RADIUS_KM = 8.0   # zones within this distance influence each other

# Zone thresholds on final 0–100 risk score
ZONE_GREEN_MAX  = 39
ZONE_YELLOW_MAX = 69
# > 69 → RED


def _get_area_profile(area_id: str) -> dict:
    return AREA_PROFILE.get(area_id, {
        "population": 300_000, "density": 9_000, "area_sqkm": 35,
        "mobility_hub": False, "baseline_burden": 0.50,
        "name": area_id,
    })


def _disease_severity_multiplier(disease_name: str) -> float:
    return DISEASE_SEVERITY.get(disease_name.lower().strip(), 1.0)


# ── Core Epidemiological Risk Score ───────────────────────────────────────────

def compute_area_risk_score(
    area_id: str,
    total_cases: int,
    total_deaths: int,
    diseases: list,
    all_area_data: dict,   # {area_id: {lat, lon, total_cases, population, ...}}
    area_lat: float,
    area_lon: float,
) -> dict:
    """
    Compute a 0–100 epidemiological risk score for an area using
    population-normalized, weighted, multi-factor scoring.

    Factors (weights sum to 1.0):
      0.30  cases_per_100k_population   (population-normalized incidence)
      0.20  case_growth_rate            (simulated from variance in reports)
      0.15  disease_severity            (weighted by disease type)
      0.15  hospital_stress_proxy       (deaths / cases ratio + absolute load)
      0.10  neighbor_spread_influence   (RED/YELLOW neighbors within 8 km)
      0.10  density_vulnerability       (low-density areas hit harder per case)
    """
    profile = _get_area_profile(area_id)
    pop     = profile["population"]
    density = profile["density"]
    burden  = profile["baseline_burden"]
    is_hub  = profile["mobility_hub"]

    # ── Factor 1: Population-normalised incidence (0–100) ────────────────
    # Reference: WHO alert threshold ~50 per 100k for dengue
    cases_per_100k = (total_cases / pop) * 100_000
    # Scale: 0 = 0/100k, 100 = 200+/100k (aggressive outbreaks in India)
    incidence_score = min(100.0, (cases_per_100k / 200.0) * 100.0)

    # ── Factor 2: Case growth rate proxy (0–100) ──────────────────────────
    # Use deaths/cases ratio as stress proxy; high fatality = high growth phase
    case_fatality_rate = (total_deaths / max(total_cases, 1))
    # India average CFR for dengue ~0.2%, cholera ~1%, so scale at 2% = very high
    growth_score = min(100.0, (case_fatality_rate / 0.02) * 100.0)
    # Boost for mobility hubs (higher transmission)
    if is_hub:
        growth_score = min(100.0, growth_score * 1.15)

    # ── Factor 3: Disease severity (0–100) ────────────────────────────────
    # Average multiplier across active diseases, then scale 0.8–1.5 → 0–100
    avg_severity = sum(_disease_severity_multiplier(d) for d in diseases) / max(len(diseases), 1)
    severity_score = min(100.0, max(0.0, (avg_severity - 0.8) / 0.7) * 100.0)

    # ── Factor 4: Hospital stress proxy (0–100) ───────────────────────────
    # Based on absolute case load relative to area capacity
    # Estimate hospital bed capacity ~ density * area_sqkm * 0.003
    area_sqkm = profile.get("area_sqkm", 35)
    bed_capacity = density * area_sqkm * 0.003
    hospital_utilisation = min(1.0, total_cases / max(bed_capacity, 1))
    hospital_score = hospital_utilisation * 100.0

    # ── Factor 5: Neighbor spread influence (0–100) ───────────────────────
    neighbor_score = 0.0
    for other_id, other in all_area_data.items():
        if other_id == area_id:
            continue
        dist = haversine_km(area_lat, area_lon, other.get("lat", area_lat), other.get("lon", area_lon))
        if dist > NEIGHBOR_RADIUS_KM:
            continue
        # Influence decays with distance; max influence from immediate neighbor
        influence_factor = max(0.0, 1.0 - dist / NEIGHBOR_RADIUS_KM)
        other_score = other.get("raw_incidence_score", 0)
        neighbor_score += influence_factor * other_score * 0.4

    neighbor_score = min(100.0, neighbor_score)

    # ── Factor 6: Density vulnerability (0–100) ───────────────────────────
    # INVERSE density effect: sparse areas have worse sanitation access
    # Dense urban areas have hospitals nearby → faster response → lower risk per case
    # Scale: density 5000 → high vulnerability, 25000 → low vulnerability
    density_vulnerability = max(0.0, min(1.0, 1.0 - (density - 5000) / 20000))
    density_score = density_vulnerability * 100.0

    # ── Weighted composite (keep growth_score small if cases are tiny) ────
    # If incidence is very low, cap other factors to prevent phantom RED zones
    if incidence_score < 5.0:
        # Barely any cases → never RED regardless
        growth_score   = min(growth_score, 15.0)
        hospital_score = min(hospital_score, 20.0)

    raw_score = (
        incidence_score  * 0.30 +
        growth_score     * 0.20 +
        severity_score   * 0.15 +
        hospital_score   * 0.15 +
        neighbor_score   * 0.10 +
        density_score    * 0.10
    )

    # Apply historical burden as a mild multiplier (0.85–1.15 range)
    burden_mult = 0.85 + burden * 0.30   # burden 0.35 → ×0.955, burden 0.85 → ×1.105
    final_score = min(100.0, raw_score * burden_mult)

    # ── Zone classification ───────────────────────────────────────────────
    if final_score >= 70:
        zone = "RED"
    elif final_score >= 40:
        zone = "YELLOW"
    else:
        zone = "GREEN"

    return {
        "risk_score":       round(final_score, 1),
        "zone":             zone,
        "cases_per_100k":   round(cases_per_100k, 1),
        "incidence_score":  round(incidence_score, 1),
        "growth_score":     round(growth_score, 1),
        "severity_score":   round(severity_score, 1),
        "hospital_score":   round(hospital_score, 1),
        "neighbor_score":   round(neighbor_score, 1),
        "density_score":    round(density_score, 1),
        "population":       pop,
        "raw_incidence_score": incidence_score,  # for neighbor calc
    }


# ── Area-level aggregation (replaces aggregate_area_zones) ───────────────────

def aggregate_area_zones(reports: List[Report]) -> dict:
    """
    Build one epidemiological risk profile per area.
    Two-pass: first aggregate raw data, then compute risk scores with neighbor context.
    """
    area_map = defaultdict(lambda: {
        "area_id": "", "area_name": "",
        "clinics": set(), "diseases": set(),
        "total_cases": 0, "total_deaths": 0,
        "lat": 0.0, "lon": 0.0, "coord_count": 0,
    })

    for r in reports:
        d = area_map[r.area_id]
        d["area_id"]   = r.area_id
        d["area_name"] = r.area_name
        d["clinics"].add(r.clinic_name or r.area_name)
        d["diseases"].add(r.disease_name)
        d["total_cases"]  += r.case_count
        d["total_deaths"] += r.death_count
        d["lat"] += r.latitude
        d["lon"] += r.longitude
        d["coord_count"] += 1

    # Pass 1: compute centroids + incidence scores for neighbor calculation
    interim = {}
    for area_id, v in area_map.items():
        cnt = v["coord_count"] or 1
        lat = v["lat"] / cnt
        lon = v["lon"] / cnt
        pop = _get_area_profile(area_id)["population"]
        raw_incidence = min(100.0, (v["total_cases"] / pop) * 100_000 / 200.0 * 100.0)
        interim[area_id] = {
            "lat": lat, "lon": lon,
            "total_cases": v["total_cases"],
            "population":  pop,
            "raw_incidence_score": raw_incidence,
        }

    # Pass 2: full risk scoring with neighbor context
    result = {}
    for area_id, v in area_map.items():
        cnt = v["coord_count"] or 1
        lat = v["lat"] / cnt
        lon = v["lon"] / cnt

        risk = compute_area_risk_score(
            area_id=area_id,
            total_cases=v["total_cases"],
            total_deaths=v["total_deaths"],
            diseases=list(v["diseases"]),
            all_area_data=interim,
            area_lat=lat,
            area_lon=lon,
        )

        profile = _get_area_profile(area_id)

        result[area_id] = {
            "area_id":          area_id,
            "area_name":        v["area_name"],
            "zone":             risk["zone"],
            "risk_score":       risk["risk_score"],
            "cases_per_100k":   risk["cases_per_100k"],
            "latitude":         round(lat, 6),
            "longitude":        round(lon, 6),
            "clinic_count":     len(v["clinics"]),
            "clinic_names":     sorted(v["clinics"]),
            "diseases":         sorted(v["diseases"]),
            "disease_count":    len(v["diseases"]),
            "total_cases":      v["total_cases"],
            "total_deaths":     v["total_deaths"],
            "population":       profile["population"],
            "density":          profile["density"],
            "is_mobility_hub":  profile["mobility_hub"],
            # Score breakdown for tooltip
            "score_breakdown": {
                "incidence":  risk["incidence_score"],
                "growth":     risk["growth_score"],
                "severity":   risk["severity_score"],
                "hospital":   risk["hospital_score"],
                "neighbor":   risk["neighbor_score"],
                "density":    risk["density_score"],
            },
            # Legacy compat
            "clinic_zones": [],
        }

    return result


# ── Legacy compute_zone (kept for report_routes compatibility) ────────────────

ZONE_PRIORITY = {"RED": 2, "YELLOW": 1, "GREEN": 0}


def compute_zone(report: Report, all_reports: List[Report]) -> dict:
    """
    Lightweight per-clinic zone — used by report_routes.
    Delegates to area-level scoring when possible.
    """
    nearby = []
    for r in all_reports:
        if r.id == report.id:
            continue
        if r.disease_name.lower() != report.disease_name.lower():
            continue
        dist = haversine_km(report.latitude, report.longitude, r.latitude, r.longitude)
        if dist <= 5.0:
            nearby.append(r.clinic_name or r.area_name)

    # Simple clinic-level heuristic (area-level engine is the authoritative one)
    cases = report.case_count
    profile = _get_area_profile(report.area_id)
    pop     = profile["population"]
    per_100k = (cases / pop) * 100_000

    if per_100k >= 40 and len(nearby) >= 2:
        zone = "RED"
    elif per_100k >= 15 or len(nearby) >= 1:
        zone = "YELLOW"
    else:
        zone = "GREEN"

    return {"zone": zone, "cluster_count": len(nearby), "nearby_clinics": nearby, "nearby_areas": []}


# ═══════════════════════════════════════════════════════════════════════════════
# ALERT ENGINE — Reports are the single source of truth
# ═══════════════════════════════════════════════════════════════════════════════
#
# Data flow:  Reports → Aggregation → Alert Engine → alerts table
#
# Alert rules (all thresholds derived from verified report data only):
#   RED    — incidence ≥ 50/100k  OR  area risk_score ≥ 70
#   YELLOW — incidence ≥ 15/100k  OR  area risk_score ≥ 40  OR  ≥2 clinics same disease
#
# Deduplication: one active alert per (area_id, disease_name).
#   UPDATE existing alerts with latest live stats on every report submission.
#   Auto-resolve alerts when threshold is no longer met.
#
# Growth trend: compare last 7 days vs prior 7 days of case counts.
# ═══════════════════════════════════════════════════════════════════════════════

ALERT_RED_INCIDENCE_PER_100K    = 50.0
ALERT_YELLOW_INCIDENCE_PER_100K = 15.0
ALERT_YELLOW_MIN_CLINICS        = 2      # ≥2 clinics same disease → at least YELLOW


def _compute_growth_trend(reports_for_cluster: list) -> tuple:
    """
    Compare total cases in last 7 days vs prior 7 days.
    Returns (trend_label: str, pct_change: float)
    """
    now = datetime.now(timezone.utc)

    def _parse_ts(ts_str: str) -> datetime:
        try:
            dt = datetime.fromisoformat(ts_str)
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        except Exception:
            return now

    recent_cases = 0
    prior_cases  = 0
    for r in reports_for_cluster:
        age_days = (now - _parse_ts(r.timestamp)).total_seconds() / 86400
        if age_days <= 7:
            recent_cases += r.case_count
        elif age_days <= 14:
            prior_cases  += r.case_count

    if recent_cases == 0 and prior_cases == 0:
        return "Insufficient data", 0.0
    if prior_cases == 0:
        return "New cluster", 100.0

    pct = ((recent_cases - prior_cases) / max(prior_cases, 1)) * 100.0
    if pct > 20:
        return "Increasing", round(pct, 1)
    elif pct < -20:
        return "Decreasing", round(pct, 1)
    return "Stable", round(pct, 1)


def _build_cluster_alert_message(
    disease: str, area_name: str, clinic_count: int, clinic_names: list,
    total_cases: int, total_deaths: int, incidence_per_100k: float,
    risk_level: str, trend: str, risk_score: float,
) -> str:
    """Deterministic, data-backed alert message derived from report aggregation."""
    names_str = ", ".join(clinic_names[:4])
    if len(clinic_names) > 4:
        names_str += f" +{len(clinic_names) - 4} more"
    pfx = "🚨 Critical" if risk_level == "RED" else "⚠️ Elevated"
    death_str = f" · {total_deaths:,} death{'s' if total_deaths != 1 else ''}" if total_deaths > 0 else ""
    return (
        f"{pfx} {disease} cluster — {area_name}. "
        f"{clinic_count} reporting clinic{'s' if clinic_count != 1 else ''}: {names_str}. "
        f"{total_cases:,} combined case{'s' if total_cases != 1 else ''}{death_str}. "
        f"Incidence: {incidence_per_100k:.0f}/100k population. "
        f"Risk score: {risk_score:.0f}/100. "
        f"Trend: {trend}."
    )


def _classify_alert_level(incidence_per_100k: float, risk_score: float, clinic_count: int):
    """Return 'RED', 'YELLOW', or None. Independent of area zone."""
    if incidence_per_100k >= ALERT_RED_INCIDENCE_PER_100K or risk_score >= 70:
        return "RED"
    if (incidence_per_100k >= ALERT_YELLOW_INCIDENCE_PER_100K
            or risk_score >= 40
            or clinic_count >= ALERT_YELLOW_MIN_CLINICS):
        return "YELLOW"
    return None


def refresh_area_alerts(db: Session) -> None:
    """
    Rebuild alerts table from current reports.

    Algorithm:
      1. Group reports by (area_id, disease_name) → disease cluster
      2. For each cluster compute incidence, area risk score, growth trend
      3. Classify cluster: RED / YELLOW / None
      4. Upsert one active alert per cluster that meets threshold
      5. Auto-delete alerts for clusters that no longer meet threshold
    """
    reports = db.query(Report).all()
    if not reports:
        return

    # ── Step 1: Build per-(area, disease) clusters ───────────────────────────
    clusters: dict = defaultdict(lambda: {
        "area_id": "", "area_name": "", "disease": "",
        "clinics": set(), "reports": [],
        "total_cases": 0, "total_deaths": 0,
        "lat": 0.0, "lon": 0.0, "coord_count": 0,
    })
    for r in reports:
        key = (r.area_id, r.disease_name)
        c = clusters[key]
        c["area_id"]    = r.area_id
        c["area_name"]  = r.area_name
        c["disease"]    = r.disease_name
        c["clinics"].add(r.clinic_name or r.area_name)
        c["reports"].append(r)
        c["total_cases"]  += r.case_count
        c["total_deaths"] += r.death_count
        c["lat"]          += r.latitude
        c["lon"]          += r.longitude
        c["coord_count"]  += 1

    # ── Step 2: Get area risk scores (full engine) ───────────────────────────
    area_data = aggregate_area_zones(reports)

    active_keys: set = set()

    # ── Steps 3-4: Classify and upsert ──────────────────────────────────────
    for (area_id, disease), c in clusters.items():
        profile   = _get_area_profile(area_id)
        pop       = profile["population"]
        n_clinics = len(c["clinics"])
        clinics   = sorted(c["clinics"])

        incidence_per_100k = (c["total_cases"] / pop) * 100_000
        area_risk_score    = area_data.get(area_id, {}).get("risk_score", 0.0)

        risk_level = _classify_alert_level(incidence_per_100k, area_risk_score, n_clinics)
        if risk_level is None:
            continue

        active_keys.add((area_id, disease))
        trend, _pct = _compute_growth_trend(c["reports"])

        message = _build_cluster_alert_message(
            disease=disease, area_name=c["area_name"],
            clinic_count=n_clinics, clinic_names=clinics,
            total_cases=c["total_cases"], total_deaths=c["total_deaths"],
            incidence_per_100k=incidence_per_100k, risk_level=risk_level,
            trend=trend, risk_score=area_risk_score,
        )
        affected_str = ",".join(clinics[:10])

        existing = (
            db.query(Alert)
            .filter(Alert.area_id == area_id, Alert.disease_name == disease, Alert.status == "active")
            .first()
        )
        if existing:
            existing.message           = message
            existing.clinics_involved  = n_clinics
            existing.affected_clinics  = affected_str
            existing.risk_level        = risk_level
            existing.timestamp         = _now()
        else:
            db.add(Alert(
                area_id=area_id, area_name=c["area_name"], disease_name=disease,
                message=message, clinics_involved=n_clinics, affected_clinics=affected_str,
                risk_level=risk_level, status="active", timestamp=_now(),
            ))

    # ── Step 5: Auto-resolve stale alerts ────────────────────────────────────
    for alert in db.query(Alert).filter(Alert.status == "active").all():
        if (alert.area_id, alert.disease_name) not in active_keys:
            db.delete(alert)

    db.commit()

