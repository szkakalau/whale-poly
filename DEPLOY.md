# Deployment Guide for Sight Whale

This guide will walk you through deploying the **Whale Intelligence** (Backend) and **Whale Landing** (Frontend) to Render and Vercel respectively.

## Prerequisites

- A GitHub repository with this project code.
- Accounts on [Render](https://render.com/) and [Vercel](https://vercel.com/).
- Your Telegram Bot Token.

---

## Part 1: Database (PostgreSQL on Render)

1. Log in to **Render Dashboard**.
2. Click **New +** -> **PostgreSQL**.
3. **Name**: `whale-db` (or any name).
4. **Database**: `whale_intelligence` (optional, can leave default).
5. **User**: (leave default).
6. **Region**: Choose one close to you (e.g., Singapore, Frankfurt, Oregon).
7. **Instance Type**: **Free** (for testing) or **Starter** (recommended for production).
8. Click **Create Database**.
9. Wait for it to become "Available".
10. Copy the **Internal Database URL** (for backend on Render) and **External Database URL** (for local access if needed).

---

## Part 2: Backend (whale-intelligence on Render)

1. On Render Dashboard, click **New +** -> **Web Service**.
2. Connect your GitHub repository.
3. **Name**: `whale-api`
4. **Root Directory**: `whale-intelligence` (Important!)
5. **Environment**: `Node`
6. **Region**: Same as your database.
7. **Branch**: `main` (or your working branch).
8. **Build Command**: `npm install && npm run build`
   - *Note: We updated package.json to generate Prisma client during build.*
9. **Start Command**: `npm run start:prod`
   - *Note: This runs database migrations and then starts the server.*
10. **Environment Variables** (Add these):
    - `DATABASE_URL`: Paste the **Internal Database URL** from Part 1.
    - `TELEGRAM_BOT_TOKEN`: Your Telegram Bot Token.
    - `POLYMARKET_TRADES_URL`: `https://clob.polymarket.com/trades`
    - `POLYMARKET_MARKETS_URL`: `https://clob.polymarket.com/markets`
    - `POLYMARKET_ORDERBOOK_URL`: `https://clob.polymarket.com/orderbook`
    - `NODE_ENV`: `production`
    - (Optional) Stripe keys if you have them.
11. Click **Create Web Service**.
12. Wait for the deployment to finish. Render will verify the service is live.
13. **Copy the Service URL** (e.g., `https://whale-api.onrender.com`). You will need this for the frontend if you add API calls later.

---

## Part 3: Frontend (whale-landing on Vercel)

1. Log in to **Vercel Dashboard**.
2. Click **Add New ...** -> **Project**.
3. Import your GitHub repository.
4. **Framework Preset**: Next.js (should be auto-detected).
5. **Root Directory**: Click "Edit" and select `whale-landing`.
6. **Build and Output Settings**: Default is usually fine (`next build`).
7. **Environment Variables**:
   - If your frontend needs to talk to the backend (currently it's mostly static), add:
   - `NEXT_PUBLIC_API_URL`: The Backend Service URL from Part 2 (e.g., `https://whale-api.onrender.com`).
8. Click **Deploy**.
9. Once deployed, Vercel will give you a domain (e.g., `whale-landing.vercel.app`).

## Part 4: Domain Configuration (sightwhale.com)

1. Go to your Vercel Project Settings -> **Domains**.
2. Add `sightwhale.com`.
3. Follow the instructions to configure your DNS (A Record or CNAME) at your domain registrar.
4. Once verified, your frontend will be live at `https://sightwhale.com`.

## Part 5: Final Check

1. Update your Backend's CORS configuration if needed.
   - We already added `https://sightwhale.com` to the allowed origins in `src/index.ts`.
   - If you use the Render URL directly or Vercel default domain, you might need to add them too, but for `sightwhale.com` it is already set.

## Troubleshooting

- **Database Connection Error**: Ensure `DATABASE_URL` is correct and the Render Web Service is in the same region as the Database (for Internal URL).
- **Prisma Error**: Check logs. `npm run start:prod` runs migrations. If it fails, you might need to drop the database tables and restart if there's a schema conflict, or check the migration files.
