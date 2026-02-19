# Docker Install Guide

## 1) Create a data directory on the host

This is where the SQLite DB lives (persisted across container rebuilds).

Example (Synology):
- `/volume1/docker/fitness-habit-tracker/data`

## 2) Run with docker compose

Create `docker-compose.yaml`:

```yaml
services:
  fitness-habit-tracker:
    image: ghcr.io/rellerton/fitness-habit-tracker:latest
    container_name: fitness-habit-tracker
    restart: unless-stopped
    ports:
      - "3010:3000"   # host:container (change host port if you want)
    environment:
      NODE_ENV: production
      DATABASE_URL: file:/app/data/dev.db
    volumes:
      - /volume1/docker/fitness-habit-tracker/data:/app/data
```

Then run:

```bash
docker compose up -d
```

Open the app at `http://<host>:3010`.

## Updating Docker deployment

```bash
docker compose pull
docker compose up -d
```
