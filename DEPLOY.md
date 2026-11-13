# Deploying

The app is two independent parts, both built from the repo root:

- **Backend** — the Flask API (`run.py` → `optimizer_api.py`), served by gunicorn.
- **Frontend** — the React app, built by Vite into static files in `dist/`.

Any host that can run Python 3.10+ (tested on 3.14) and serve static files (or run Node 20+ / Docker) works. Deploy the backend first: the frontend build needs its public URL.

You will also need:

- A **MongoDB Atlas** database (`MONGO_URI`) to keep optimization runs. Without one the API still works on built-in seed data (see [Backend](#backend)).
- A **HERE Maps** API key (`HERE_API_KEY`) for address lookup on the Route Test page and for road distances and travel times in the optimizer. Without one the optimizer still works, on straight-line distances at each vehicle's fixed speed (see [Backend](#backend)).

---

## MongoDB Atlas

1. Sign up at <https://www.mongodb.com/cloud/atlas/register> and create a free **M0** cluster.
2. **Database Access** → create a user; save the username and password.
3. **Network Access** → allow the IP address of your backend host (or `0.0.0.0/0` if it has no fixed IP).
4. **Connect** → **Drivers** → copy the connection string, e.g. `mongodb+srv://USER:PASS@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`, with your credentials filled in.
5. Load the seed data once, from any machine with the repo and that connection string in `.env`:

   ```
   pip install -r requirements.txt
   python seed_db.py
   ```

   Re-run it to reset areas, vehicles, depot and solver config. It does not delete saved runs.

## HERE Maps API key

Sign up at <https://platform.here.com/>, create a project and generate an **API Key**.

---

## Backend

**Build**

```
pip install -r requirements.txt
```

**Start**

```
gunicorn run:app --bind 0.0.0.0:$PORT --workers 2 --timeout 120
```

- `--timeout 120` is required. The solver runs for up to 30 seconds by default, and gunicorn's own default timeout (30 s) would kill the worker mid-solve and return a 502.
- `$PORT` is the port your host routes traffic to. Most platforms set it; otherwise pick one (the local default is 5001).

**Environment variables**

| Name | Required | Value |
| --- | --- | --- |
| `MONGO_URI` | For saved runs | Atlas connection string. If it is missing or Atlas is unreachable at startup, the API logs a warning and serves in-memory seed data; runs are lost on restart, and each gunicorn worker keeps its own copy. |
| `MONGO_DB` | No | Database name, default `fleet_optimizer`. |
| `HERE_API_KEY` | For geocoding and road distances | HERE API key, used for the Geocoding API and the Matrix Routing API v8. Without it `/api/geocode` returns `missing_api_key`, and the optimizer uses straight-line distances at each vehicle's fixed speed instead of road distances and travel times. It does the same, with a warning in the log, when the HERE request fails. Responses say which was used in `distance_source` (`road` or `straight_line`). |
| `PORT` | Yes | Port to bind, used in the start command above. |

**Check it:** `GET https://<backend-host>/health` returns `{"solver":"PuLP/CBC","status":"ok"}`.

The API allows requests from any origin (flask-cors defaults), so the frontend can live on a different domain without extra configuration.

---

## Frontend

**Build**

```
npm ci
VITE_API_URL=https://<backend-host> npm run build
```

`VITE_API_URL` must point at the deployed backend, with no trailing slash. Vite writes it into the bundle at **build** time, so changing it means rebuilding. Without it the app calls `http://localhost:5001`, which only works locally.

**Serve** `dist/` in one of these ways:

- **Any static file host or CDN.** The app uses client-side routing, so configure the host to answer unknown paths with `index.html` (often called an SPA fallback or rewrite rule).
- **`npm start`** on a Node host. It runs `vite preview --host 0.0.0.0 --port ${PORT:-4173}`. Set `PREVIEW_ALLOWED_HOSTS` to the public hostname (comma-separate several), or Vite answers other hostnames with 403.
- **Docker**, using `Dockerfile.frontend`:

  ```
  docker build -f Dockerfile.frontend --build-arg VITE_API_URL=https://<backend-host> -t fleet-frontend .
  docker run -p 4173:4173 -e PREVIEW_ALLOWED_HOSTS=<frontend-host> fleet-frontend
  ```

**Environment variables**

| Name | When | Value |
| --- | --- | --- |
| `VITE_API_URL` | Build | Public URL of the backend. |
| `VITE_IOT_USE_MOCK` | Build | `true` (default) starts the IoT feed on mock telemetry. |
| `PREVIEW_ALLOWED_HOSTS` | Start (`npm start` / Docker only) | Public hostname(s) of the frontend. |
| `PORT` | Start (`npm start` only) | Port to bind, default 4173. |

**Check it:** open the frontend URL. The Live Fleet map should load routes from `/fleet-routes`, and **Run Optimization** should return results from `/optimize`.

---

## All variables

`.env.example` lists every variable with placeholder values. Copy it to `.env` for local development; on a host, set the same names in its environment settings. `.env` is git-ignored — never commit it. `VITE_IOT_DEVICE_URL` only matters for local development with the ESP32.

---

## Local development

1. Backend: `pip install -r requirements.txt`, then `python optimizer_api.py` or `python run.py`. Both listen on `:5001` (override with `PORT`). Not 5000, because macOS AirPlay Receiver listens there.
2. Frontend: `npm install`, then `npm run dev`. The frontend calls `http://localhost:5001` unless `VITE_API_URL` is set.

---

## Notes / known limitations

- The ESP32 IoT device proxy (`/iot-device/...`) exists only under `npm run dev`; a deployed frontend can't reach a device on your local network. The IoT feed defaults to mock telemetry; switching the Live Fleet map toggle to **ESP32** in production shows a disconnected state.
- The solver stops after `time_limit_seconds` (default 30) or once it is within `solver_gap` (default 0.05, i.e. 5%) of the best bound. Both come from the `optimization_config` collection, and the optimizer page sends the same values with each run. A database seeded before these defaults existed has no time limit stored; run `python seed_db.py` once against it to update the config.
- `vite preview` is adequate for this workload. For more traffic, serve `dist/` from a static file server or CDN instead.
