# LIFE SCHEDULE

Personal planner: daily schedule, tasks, and before/during/after event planning.

- **Frontend**: Angular 21, served by **Vercel**.
- **Backend**: Express API, deployed as a **Vercel serverless function** (free Hobby plan).
- **Data**: **Cloud Firestore** (free Spark plan) via `firebase-admin`.

Everything runs on **free tiers** — no Blaze/pay-as-you-go upgrade required.

```
Browser ──► Vercel
              ├── /           Angular SPA (static)
              └── /api/*      api/index.js  (Express, serverless)
                                    │  firebase-admin + service-account key
                                    ▼
                              Cloud Firestore (Spark)
```

Vercel project: `life-schedule` · Firebase project: `life-schedule-planner` ·
Firestore region: `asia-southeast1`.

---

## 1. Backend — Vercel serverless function + Firestore

The Express app (`backend/src/app.js`) is mounted by [`api/index.js`](api/index.js), which
Vercel builds as a serverless function. It talks to Firestore through
`backend/src/storage/firestore.js`.

### One-time setup
1. Create the Firestore database (free Spark plan):
   ```sh
   firebase firestore:databases:create "(default)" --location asia-southeast1
   firebase deploy --only firestore:rules
   ```
2. Create a service-account key for the Firebase Admin SDK and add it to Vercel as an
   environment variable (this is already done for the `life-schedule` project):
   - Key: `FIREBASE_SERVICE_ACCOUNT_KEY` = the full service-account JSON (encrypted).
   - `STORAGE_DRIVER=firestore`
   - `CORS_ORIGIN=*` (or a comma-separated allow-list of your Vercel origins).

   The service account used is
   `firebase-adminsdk-fbsvc@life-schedule-planner.iam.gserviceaccount.com`.

### Deploy
```sh
npm run deploy          # vercel --prod
```
Vercel:
- Install: `npm install && npm install --prefix frontend`
- Build: `npm run build --prefix frontend`
- Output: `frontend/dist/frontend/browser`
- Functions: `api/index.js` (root deps: `express`, `cors`, `firebase-admin`)
- Rewrites: `/api/(.*)` → `/api/index.js`, everything else → `/index.html`

> **Plan note:** unlike Firebase Cloud Functions, Vercel serverless functions are free on
> the Hobby plan, so no billing upgrade is needed. Firestore stays within the Spark free
> tier (50K reads / 20K writes / 20K deletes per day, 1 GiB stored).

---

## 2. Frontend — Vercel

The Angular app and the API share one origin, so the production API URL is relative:
- dev: `frontend/src/environments/environment.ts` → `http://localhost:3000/api`
- prod: `frontend/src/environments/environment.prod.ts` → `/api`

---

## 3. Local development

```sh
npm run install:all
npm run start:backend     # http://localhost:3000/api  (file storage in backend/data)
npm run start:frontend    # http://localhost:4200
```

To run the backend against the Firestore emulator instead of the file store:
```sh
firebase emulators:exec --only firestore --project demo-life-schedule "node your-script.mjs"
# or, in a shell: STORAGE_DRIVER=firestore FIRESTORE_EMULATOR_HOST=localhost:8080
```

Storage driver is chosen by `STORAGE_DRIVER` (`firestore` | `file` | `memory`); it defaults
to `firestore` when a Firebase/Vercel service account is present, `file` in dev, and
`memory` for bare production Node.

---

## API endpoints

`GET /api/health`, `GET/POST/PUT/DELETE /api/tasks`, `PATCH /api/tasks/:id/status`,
`PATCH /api/tasks/:id/reschedule`, `GET/POST/PUT/DELETE /api/events`,
`GET/POST/PUT/DELETE /api/journal`, `GET/POST/PUT/DELETE /api/goals`,
`GET /api/stats`, `GET /api/data/export`, `POST /api/data/import`, `POST /api/data/backup`.

### Firestore layout
```
lifeSchedule/{tasks|events|journalEntries|goals} -> { items:[...], updatedAt }
lifeScheduleBackups/{ISO-timestamp}-{label}      -> { createdAt, label, data }
```
Each collection is a single document (Firestore's 1 MiB/document limit applies). Mutations
serialize per instance and only rewrite changed collections to stay inside the free quota.

Client access is denied by [`firestore.rules`](firestore.rules); only the server (Admin SDK)
can read/write.
