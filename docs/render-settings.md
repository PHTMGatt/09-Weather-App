# Render settings (faster cold starts)

Change these on the Render service, then deploy. Nothing here is applied yet.

| Setting | Value |
|---|---|
| Root directory | repo root (leave blank) |
| Build Command | `npm run render-build` (runs `npm install && npm run build`: client build + server `tsc`) |
| Start Command | `npm start` (runs `node dist/server.js`, no build at boot) |
| Env vars | `API_KEY` (weather provider key, set in dashboard, never in the repo). `PORT` is set by Render |

Why: the build used to run on every start, so each cold start waited for it. Now it runs once per deploy.

Rollback: Render dashboard, Events, Rollback to previous deploy, and set Build Command back to the old value.

After deploy: `scripts/smoke.sh https://<service>.onrender.com` (home, history API, 404 handling, cold-start timing).
