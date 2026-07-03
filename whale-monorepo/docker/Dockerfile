# ── Builder stage ──────────────────────────────────────────────────────────────
FROM python:3.11-slim AS builder

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates gcc libpq-dev \
  && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --user --no-cache-dir --no-warn-script-location -r requirements.txt

# ── Runner stage ──────────────────────────────────────────────────────────────
FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Copy only installed packages from builder (PF-H14: multi-stage build).
COPY --from=builder /root/.local /root/.local
ENV PATH=/root/.local/bin:$PATH

COPY . .

# Ensure maintenance scripts are present in the image build context (catches wrong rootDir or missing git files early).
RUN test -f scripts/backfill_whale_trade_history_from_raw_for_profiles.py \
  && test -f scripts/recompute_whale_trade_history_pnl.py

# Run as non-root user
RUN addgroup --system app && adduser --system --ingroup app app \
  && chown -R app:app /app
USER app
