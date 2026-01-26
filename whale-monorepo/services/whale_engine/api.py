from fastapi import FastAPI

from shared.config import settings
from shared.logging import configure_logging


configure_logging(settings.log_level)

app = FastAPI(title="whale-engine")


@app.get("/health")
async def health():
  return {"status": "ok"}

