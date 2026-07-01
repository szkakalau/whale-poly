FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates postgresql-client \
  && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Ensure maintenance scripts are present in the image build context (catches wrong rootDir or missing git files early).
RUN test -f scripts/backfill_whale_trade_history_from_raw_for_profiles.py \
  && test -f scripts/recompute_whale_trade_history_pnl.py

# Run as non-root user
RUN addgroup --system app && adduser --system --ingroup app app \
  && chown -R app:app /app
USER app
