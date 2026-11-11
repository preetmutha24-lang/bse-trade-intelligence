# Video Walkthrough Guide

## Goal

Create a short but convincing walkthrough that demonstrates the full BSE Trade Intelligence experience from API trigger to real-time dashboard update.

## Recommended Recording Flow

1. Open the frontend dashboard at http://localhost:5173.
2. Show the top-level overview with metrics and the live SSE indicator.
3. Open the backend health endpoint in a browser or terminal: http://localhost:4000/api/health.
4. Show the JSON response with backend, database, and worker status.
5. Trigger a new pull from the pull operations section or by calling the API with curl/Postman.
6. Capture the immediate HTTP 202 response and note that the request returns before the worker finishes.
7. Keep the dashboard visible while the background job completes.
8. Show the `pull_completed` update arriving automatically on the already-open dashboard without refreshing.
9. Highlight the newly inserted trades appearing in the trade tables and analytics views.
10. Stop the recording after showing the database and metrics remain stable.

## Suggested Script

> “This dashboard demonstrates a real-time trade intelligence workflow. The backend accepts a pull request, returns immediately with HTTP 202, and continues the work asynchronously in the background. The dashboard remains connected through SSE and receives `pull_completed` automatically without polling or page refresh.”

## Technical Notes for the Video

- Keep the browser and terminal side-by-side for a clear API-to-UI story.
- Use a small sample trigger such as 200 or 300 records to keep the run short and easy to follow.
- If the job runs too quickly, set a small delay or use the demo mode configuration to create a visible window.
- Explain that SQLite keeps the trade records and job history durable, while SSE drives the dashboard updates in near real time.

## Final Check Before Publishing

At minimum, the video should clearly show:

- backend health is healthy
- `POST /api/pulls` returns 202 immediately
- background worker completes successfully
- SSE broadcast arrives without a browser refresh
- new trade records appear live in the dashboard
