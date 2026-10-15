# LIFE SCHEDULE

Personal planner: daily schedule, tasks, and before/during/after event planning.
Angular 21 frontend, Express backend.

## Vercel Deployment

This repo is configured for single-project Vercel deployment (frontend + API under /api).

- Root `vercel.json` builds frontend and routes to API functions in `/api`.
- API base is `/api` for both dev and production.
- Storage: Vercel Blob if `BLOB_READ_WRITE_TOKEN` is set; falls back to in-memory in production if not; uses local file in dev.

To deploy: push to GitHub ? import to Vercel ? set env vars (`BLOB_READ_WRITE_TOKEN`, `CORS_ORIGIN` optional) ? deploy.
"# LIFE_SCHEDULE" 
