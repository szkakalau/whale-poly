# ── Builder stage ──────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN npm run build

# Remove devDependencies from node_modules so the runner image stays small.
RUN npm prune --omit=dev

# ── Runner stage ──────────────────────────────────────────────────────────────
FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy only production artifacts from builder (PF-H14: multi-stage build).
COPY --from=builder /app/.next .next
COPY --from=builder /app/public public
COPY --from=builder /app/node_modules node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/prisma prisma

EXPOSE 3000

# Run as non-root user
RUN addgroup --system app && adduser --system --ingroup app app \
  && chown -R app:app /app
USER app

CMD ["npm", "run", "start"]
