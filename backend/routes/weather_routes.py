"""
weather_routes.py — Hyderabad weather from Open-Meteo (free, no key required).

IMPORTANT: This module provides weather data ONLY.
It does NOT infer disease risk from weather.
Weather × disease correlations require validated epidemiological models
that are not implemented here.
"""

import httpx
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from cachetools import TTLCache
from auth import get_current_user

router = APIRouter(prefix="/weather", tags=["Weather"])

_cache: TTLCache = TTLCache(maxsize=16, ttl=1800)   # 30-min cache

HYD_LAT, HYD_LON = 17.385, 78.4867

OPEN_METEO_URL = (
    "https://api.open-meteo.com/v1/forecast"
    "?latitude={lat}&longitude={lon}"
    "&current=temperature_2m,relative_humidity_2m,apparent_temperature,"
    "precipitation,rain,weather_code,wind_speed_10m,wind_direction_10m,uv_index,surface_pressure"
    "&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,"
    "uv_index_max,precipitation_probability_max"
    "&forecast_days=7&timezone=Asia%2FKolkata"
)

WMO_CODES = {
    0: "Clear sky",    1: "Mainly clear",  2: "Partly cloudy",  3: "Overcast",
    45: "Foggy",       51: "Light drizzle",53: "Moderate drizzle",55: "Dense drizzle",
    61: "Slight rain", 63: "Moderate rain",65: "Heavy rain",
    80: "Showers",     81: "Moderate showers", 82: "Violent showers",
    95: "Thunderstorm",96: "Thunderstorm + hail",
}

# Fallback data — clearly labelled as simulated
MOCK_WEATHER = {
    "current": {
        "temperature": 34.2, "feels_like": 38.7, "humidity": 72,
        "precipitation": 0.0, "rain": 0.0, "wind_speed": 12.4,
        "wind_direction": 225, "uv_index": 8.2, "pressure": 1008.3,
        "condition": "Partly cloudy", "condition_code": 2, "timestamp": None,
    },
    "daily": [
        {"date": "Today",    "temp_max": 36, "temp_min": 27, "rain_sum": 0.0,  "rain_prob": 20, "uv_max": 9},
        {"date": "Tomorrow", "temp_max": 34, "temp_min": 26, "rain_sum": 2.4,  "rain_prob": 55, "uv_max": 7},
        {"date": "Day 3",    "temp_max": 31, "temp_min": 25, "rain_sum": 8.1,  "rain_prob": 75, "uv_max": 5},
        {"date": "Day 4",    "temp_max": 30, "temp_min": 24, "rain_sum": 12.3, "rain_prob": 85, "uv_max": 4},
        {"date": "Day 5",    "temp_max": 29, "temp_min": 24, "rain_sum": 5.6,  "rain_prob": 60, "uv_max": 6},
        {"date": "Day 6",    "temp_max": 32, "temp_min": 25, "rain_sum": 1.2,  "rain_prob": 30, "uv_max": 8},
        {"date": "Day 7",    "temp_max": 35, "temp_min": 26, "rain_sum": 0.0,  "rain_prob": 15, "uv_max": 9},
    ],
    "source": "simulated",
    "disclaimer": "API unavailable — displaying simulated weather data for demonstration.",
}


async def _fetch_open_meteo() -> dict:
    url = OPEN_METEO_URL.format(lat=HYD_LAT, lon=HYD_LON)
    async with httpx.AsyncClient(timeout=8.0) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        return resp.json()


def _parse_weather(raw: dict) -> dict:
    c     = raw.get("current", {})
    daily = raw.get("daily", {})
    days  = []
    for i in range(len(daily.get("time", []))):
        label = "Today" if i == 0 else ("Tomorrow" if i == 1 else f"Day {i+1}")
        days.append({
            "date":      label,
            "temp_max":  daily["temperature_2m_max"][i],
            "temp_min":  daily["temperature_2m_min"][i],
            "rain_sum":  daily["precipitation_sum"][i],
            "rain_prob": daily.get("precipitation_probability_max", [0]*7)[i],
            "uv_max":    daily.get("uv_index_max", [0]*7)[i],
        })
    return {
        "current": {
            "temperature":  c.get("temperature_2m"),
            "feels_like":   c.get("apparent_temperature"),
            "humidity":     c.get("relative_humidity_2m"),
            "precipitation":c.get("precipitation", 0),
            "rain":         c.get("rain", 0),
            "wind_speed":   c.get("wind_speed_10m"),
            "wind_direction": c.get("wind_direction_10m"),
            "uv_index":     c.get("uv_index"),
            "pressure":     c.get("surface_pressure"),
            "condition":    WMO_CODES.get(c.get("weather_code", 0), "Unknown"),
            "condition_code": c.get("weather_code", 0),
            "timestamp":    datetime.now(timezone.utc).isoformat(),
        },
        "daily":      days,
        "source":     "open-meteo",
        "disclaimer": "Weather data from Open-Meteo API. No disease risk inference is performed.",
    }


@router.get("/current")
async def get_current_weather(current_user: dict = Depends(get_current_user)):
    """
    Current Hyderabad weather from Open-Meteo API (cached 30 min).
    Returns raw meteorological data only — no disease risk scores.
    """
    if "weather_current" in _cache:
        return _cache["weather_current"]
    try:
        raw    = await _fetch_open_meteo()
        result = _parse_weather(raw)
    except Exception as exc:
        result = dict(MOCK_WEATHER)
        result["current"] = dict(MOCK_WEATHER["current"])
        result["current"]["timestamp"] = datetime.now(timezone.utc).isoformat()
        result["fetch_error"] = type(exc).__name__
    _cache["weather_current"] = result
    return result
