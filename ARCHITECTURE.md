# Architecture Overview

## System Design

The application is structured as a small fintech operations platform with a clear separation between API handling, persistence, background processing, and real-time event delivery.

### 1. Backend API Layer

The backend is built with Express and is responsible for:

- exposing dashboard and trade endpoints
- validating request payloads
- serving the SSE event stream
- starting background pull jobs
- reporting application health diagnostics

### 2. SQLite Data Layer

The project uses SQLite with better-sqlite3 for:

- trade records with unique trade IDs
- job lifecycle tracking (`QUEUED`, `RUNNING`, `COMPLETED`, `FAILED`)
- seeded market data for demo readiness
- duplicate prevention via unique constraint on `trade_id`

### 3. Background Worker

Long-running trade retrieval is decoupled from the API request lifecycle. A pull starts immediately, creates a job record, and then continues asynchronously in a worker flow.

This guarantees that the original HTTP request can return immediately with HTTP 202 while the application continues processing in the background.

### 4. SSE Event Channel

The SSE manager maintains a working set of open client connections and broadcasts events such as:

- `connected`
- `pull_started`
- `pull_completed`
- `pull_failed`

Connected dashboard clients receive these events without polling. The frontend listens for them and updates the UI in real time.

### 5. Frontend Dashboard

The frontend is a React + Vite single-page application with:

- overview metrics
- trade explorer
- pull operations monitoring
- analytics charts
- system health status

The UI stays automatically synchronized through SSE instead of polling the backend.

## Data Flow

1. A user or API client triggers a pull via `POST /api/pulls`.
2. The server creates a queue record and immediately returns a 202 response.
3. The background worker fetches mock exchange data.
4. Records are imported into SQLite while preserving the unique trade ID constraint.
5. The worker updates the job status to `COMPLETED` or `FAILED`.
6. SSE broadcasts the result to all connected dashboard clients.
7. The frontend updates the relevant widgets and lists live.

## Important Design Choice

The original HTTP request never remains open during the 15-minute operation because the real processing is intentionally delegated to the background worker. This is the core architectural requirement that keeps the service responsive and avoids request blocking.

## Security and Operational Guardrails

- CORS is limited to known frontend origins.
- Helmet is enabled to improve response headers.
- SQLite WAL mode is used for smoother local writes.
- Stale `RUNNING` jobs are marked failed on restart to avoid inconsistent state.

## Local Runtime Defaults

- Frontend: http://localhost:5173
- Backend: http://localhost:4000
- Database: `./backend/data/bse_trade_intelligence.sqlite`
- Demo duration: approximately 10 seconds in demo mode
