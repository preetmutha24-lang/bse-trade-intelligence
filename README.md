# BSE Trade Intelligence

A fintech-style trade intelligence dashboard that retrieves mock BSE market data, persists it in SQLite, and broadcasts real-time status updates to connected clients through Server-Sent Events (SSE).

## Overview

This project demonstrates a full-stack application with:

- Express backend API with persistent SQLite storage
- Background pull worker that processes long-running trade retrieval without holding the original HTTP request open
- SSE stream for live dashboard updates
- React + Vite frontend dashboard with operational monitoring, analytics, and trade browsing
- Mock BSE exchange service with deterministic seeded trade records

## Tech Stack

- Backend: Node.js 22, Express, better-sqlite3
- Frontend: React, Vite, Recharts, Lucide icons
- Real-time: Server-Sent Events
- Persistence: SQLite

## Project Structure

- `backend/` — Express server, SQLite schema, worker, mock API
- `frontend/` — React dashboard and UI
- `data/` — local database and runtime state
- `docs/` — demonstration and walkthrough documentation

## Local Development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the app:
   ```bash
   npm run dev
   ```
3. Open the live frontend:
   - http://localhost:5173
4. Check the backend API:
   - http://localhost:4000/api/health

## Required API Behavior

- `GET /getTrades?count=50&delayMs=0` — returns mock trade data from the BSE exchange service.
- `GET /api/trades` — returns persisted trade records for dashboard exploration.
- `GET /api/stats` — returns summary metrics.
- `GET /api/events` — opens an SSE stream for live updates.
- `POST /api/pulls` — starts a background pull job and returns immediately with HTTP 202.
- `GET /api/pulls` — shows recent job history.
- `GET /api/health` and `/health` — report backend + database + worker health.

## Verification Commands

Run the automated regression tests:

```bash
npm --workspace backend run test
```

Build the frontend bundle:

```bash
npm --workspace frontend run build
```

## Demo Checklist

1. Open the frontend dashboard.
2. Confirm the backend health endpoint responds successfully.
3. Trigger a pull request using the operation screen or API call.
4. Observe that the POST responds immediately and the worker continues in the background.
5. Watch the SSE-connected dashboard receive `pull_completed` without refreshing the page.
6. Confirm new trade records are visible automatically in the UI.

## GitHub / Deployment Notes

This workspace is not yet initialized as a Git repository and no GitHub remote is configured. To publish this project:

```bash
git init
git add .
git commit -m "Initial BSE Trade Intelligence app"
git branch -M main
git remote add origin <your-github-repository-url>
git push -u origin main
```

Deploying to a production host requires a target environment and valid hosting credentials. The app is currently verified for local development at the URLs above.

## Final Notes

The app is configured for local demo behavior using the default SQLite data store and local SSE connection flow. The real-time job processing does not hold the original HTTP request open, which is a core requirement of the implementation.
