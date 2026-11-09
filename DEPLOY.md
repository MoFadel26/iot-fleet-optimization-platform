# Deploying to Railway

This project ships as **two Railway services** built from the same GitHub repo: a Flask backend and a Vite-built React frontend. The repo is flat (no `/backend` or `/frontend` subfolders), so both services point at the repo root and differ only in build/start commands and environment variables.

You will also need:

- A free **MongoDB Atlas** database (`MONGO_URI`)
- A free **HERE Maps** API key (`HERE_API_KEY`)

---

## 1. Push the repo to GitHub

Railway pulls code from a GitHub repo. If this project isn't already on GitHub, push it first.

## 2. Create a MongoDB Atlas database

1. Sign up at <https://www.mongodb.com/cloud/atlas/register>.
2. Create a free **M0** cluster.
3. **Database Access** → create a user; save the username + password.
4. **Network Access** → **Add IP Address** → **Allow Access from Anywhere** (`0.0.0.0/0`).
5. **Connect** → **Drivers** → copy the connection string. It looks like `mongodb+srv://USER:PASS@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`. Replace `USER`/`PASS` with the credentials from step 3 and save it.

## 3. Get a HERE Maps API key

1. Sign up at <https://platform.here.com/>.
2. Create a project and generate an **API Key**. Save it.

## 4. Deploy the backend service

1. In Railway, **New Project** → **Deploy from GitHub repo** → pick this repo.
2. After the first deploy attempt, open the service → **Settings** and confirm:
   - **Root Directory:** `/` (the repo root)
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `gunicorn run:app --bind 0.0.0.0:$PORT --workers 2` (also in `Procfile`)
3. **Variables** — add:

   | Name | Value |
   | --- | --- |
   | `MONGO_URI` | the connection string from step 2 |
   | `MONGO_DB` | `fleet_optimizer` |
   | `HERE_API_KEY` | the key from step 3 |

4. **Settings → Networking → Generate Domain** to get a public HTTPS URL (e.g. `https://fleet-optimizer-api.up.railway.app`). Save this — the frontend service needs it.
5. Redeploy. Watch the logs until you see gunicorn boot successfully. Hit `/health` to smoke-test.

## 5. Deploy the frontend service

1. In the same Railway project, **+ New** → **GitHub Repo** → pick the **same** repo.
2. Open the new service → **Settings**:
   - **Root Directory:** `/`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start` (runs `vite preview` on `$PORT`)
3. **Variables** — add:

   | Name | Value |
   | --- | --- |
   | `VITE_API_URL` | the backend URL from step 4 (no trailing slash) |

   `VITE_API_URL` is read at **build** time, so any change to it requires a redeploy.
4. **Settings → Networking → Generate Domain** to get a public HTTPS URL for the app.

## 6. Open the app

Visit the frontend domain. The map should load and `/fleet-routes`, `/optimize`, and `/api/geocode` should round-trip to the backend.

---

## Environment variables at a glance

**Backend service**

- `MONGO_URI` *(required for saved runs)* — MongoDB Atlas connection string. If it is missing or Atlas is unreachable at startup, the API logs a warning and serves in-memory seed data; runs are lost on restart, and each gunicorn worker keeps its own copy.
- `MONGO_DB` *(optional, default `fleet_optimizer`)*
- `HERE_API_KEY` *(required for geocoding)*
- `PORT` *(injected by Railway)*

**Frontend service**

- `VITE_API_URL` *(required)* — full URL of the backend service
- `PORT` *(injected by Railway)*

`.env` is git-ignored — never commit it. `.env.example` (committed) lists every variable with placeholder values; copy it to `.env` for local development. It also lists `VITE_IOT_DEVICE_URL`, which only matters for local development with the ESP32.

---

## Local development

1. Backend: `pip install -r requirements.txt`, then `python optimizer_api.py` or `python run.py`. Both listen on `:5001` (override with `PORT`). Not 5000, because macOS AirPlay Receiver listens there.
2. Frontend: `npm install`, then `npm run dev`. The frontend calls `http://localhost:5001` unless `VITE_API_URL` is set.

---

## Notes / known limitations

- The ESP32 IoT device proxy (`/iot-device/...`) is dev-only — it can't be reached from a deployed frontend. The IoT feed defaults to mock telemetry (`VITE_IOT_USE_MOCK`, default `true`); switching the Live Fleet map toggle to **ESP32** in production shows a disconnected state.
- `vite preview` is used as the static server. It's adequate for this workload; swap to `serve -s dist -l $PORT` (and add `serve` to dev deps) if you outgrow it.
- The free-tier Railway services may sleep after inactivity; first request after a nap can take 10–30s.
