"""Shared admin authentication for FastAPI services."""

import hmac

from fastapi import Header, HTTPException

from shared.config import settings


def require_admin(x_admin_token: str | None = Header(None, alias="X-Admin-Token")) -> None:
    """Verify the X-Admin-Token header matches the configured admin token.

    Raises HTTPException(404) on failure to avoid leaking whether the
    endpoint exists (security through obscurity). Consistent across
    all 5 services.

    Uses hmac.compare_digest for constant-time comparison to prevent
    timing side-channel attacks on the admin token.
    """
    token = settings.admin_token or ""
    supplied = x_admin_token or ""
    if not token or not supplied or not hmac.compare_digest(token, supplied):
        raise HTTPException(status_code=404, detail="not_found")
