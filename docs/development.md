# Development Runbook

## Local DB backup/restore (PowerShell)

Default local DB:
- `DATABASE_URL="file:./data/dev.db"`

Create a backup copy:

```powershell
Copy-Item .\data\dev.db .\data\dev.backup.db -Force
```

Restore:

```powershell
Copy-Item .\data\dev.backup.db .\data\dev.db -Force
```

## Local DB switching (main vs feature work)

Create one DB per lane:

```powershell
Copy-Item .\data\dev.db .\data\dev.main.db -Force
Copy-Item .\data\dev.db .\data\dev.feature.db -Force
```

Work on `main` against `dev.main.db`:

```powershell
$env:DATABASE_URL='file:./data/dev.main.db'
npx prisma migrate deploy
npx prisma generate
npm run dev
```

Switch back to feature DB:

```powershell
$env:DATABASE_URL='file:./data/dev.feature.db'
npx prisma migrate deploy
npx prisma generate
npm run dev
```

Check active DB in the current shell:

```powershell
echo $env:DATABASE_URL
```

If `DATABASE_URL` points to a new or wrong file, the app can look blank because you are on a different SQLite file.

## Home Assistant add-on DB backup/restore

The add-on DB lives at:
- `/data/dev.db`

Quick manual backup (stop the add-on first):

```bash
cp /data/dev.db /data/dev.backup-$(date +%Y%m%d-%H%M%S).db
```

Restore from a backup (stop add-on, then replace):

```bash
cp /data/dev.backup-YYYYMMDD-HHMMSS.db /data/dev.db
```

## API smoke test

Run a lightweight end-to-end API check against a running app instance.

1. Start the app locally (for example: `npm run dev`).
2. In another terminal, run:

```bash
npm run test:smoke
```

Optional: target a different host/port:

```bash
SMOKE_BASE_URL=http://127.0.0.1:3010 npm run test:smoke
```

The smoke test validates core flows:
- create person
- create tracker type + category
- add tracker to person
- start round
- delete round
- remove tracker

## CI checks on main

The repository includes a CI workflow (`.github/workflows/ci.yml`) for normal development.

It runs on push/PR to `main`:
- lint
- typecheck
- build

## Health and readiness checks

The app now exposes:
- `GET /api/health` for liveness (process is up)
- `GET /api/ready` for readiness (process + DB query)

Examples:

```bash
curl http://127.0.0.1:3000/api/health
curl http://127.0.0.1:3000/api/ready
```

Docker image liveness uses `api/health` via `HEALTHCHECK`.
