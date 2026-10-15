# Deploying to Vercel

This project is configured for a single Vercel deployment (frontend + backend).

## Steps

1. Push this repo to GitHub.
2. Import the repo in Vercel (New Project ? Import Git Repository).
3. Set Root Directory to `.` (root).
4. Framework Preset: Other.
5. Build Command: `cd frontend && npm install && npm run build` (or let Vercel use the static-build from vercel.json).
6. Output Directory: `frontend/dist/frontend/browser` (configured in vercel.json).
7. Add Environment Variables:
   - `BLOB_READ_WRITE_TOKEN` - from Vercel ? Storage ? Blob
   - `CORS_ORIGIN` - `*` (or your domain)
8. Deploy.

## Notes

- Frontend uses `/api` as base URL - works in Vercel with the rewrites.
- Backend API runs as Vercel Functions under `/api/*`.
- Storage: Uses Vercel Blob if token is set; falls back to in-memory in production if not set (ephemeral); uses local file in non-production.
- All existing API endpoints are preserved.
- The frontend build output is in `frontend/dist/frontend/browser`.
