"""
cache.py — Optional Redis cache layer for Epicast session and rate-limiting helpers.
"""

import os
import logging

try:
    import redis.asyncio as aioredis
except ImportError:  # pragma: no cover
    aioredis = None

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
redis_client = None

if aioredis:
    try:
        redis_client = aioredis.from_url(
            REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=1,
            socket_timeout=1,
        )
    except Exception as err:
        logging.warning(f"Redis client disabled: {err}")
        redis_client = None
