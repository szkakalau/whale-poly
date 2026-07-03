"""Shared FastAPI exception handlers for consistent JSON error responses."""

import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

logger = logging.getLogger("shared.error_handlers")


def register_exception_handlers(app: FastAPI) -> None:
    """Register a global exception handler that returns JSON for unhandled errors.

    Without this, FastAPI returns raw HTML for unhandled exceptions,
    breaking any JSON-only API contract.
    """

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        logger.exception("unhandled_exception path=%s method=%s", request.url.path, request.method)
        return JSONResponse(
            status_code=500,
            content={"detail": "internal_server_error"},
        )
