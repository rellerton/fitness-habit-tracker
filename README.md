# Fitness Habit Tracker

A lightweight, self-hosted habit tracker built with **Next.js** + **Prisma** using a **local SQLite** database. Designed to run cleanly in Docker (including Synology Container Manager) with the database stored on a persistent volume.

## What this is

- Track habits by **person**
- Habits are grouped into **categories**
- Tracking happens inside **Rounds** (multi-week blocks)
- A visual **Round Wheel** UI makes daily checkoffs fast

## Tech stack

- Next.js (App Router)
- Prisma ORM
- SQLite (file-based DB)
- Docker / GHCR image publishing via GitHub Actions

---

## Quick start (Docker)

### 1) Create a data directory on the host

This is where the SQLite DB lives (persisted across container rebuilds).

Example (Synology):
- `/volume1/docker/fitness-habit-tracker/data`

The container expects:
- DB path inside container: `/app/data/dev.db`
- Connection string: `DATABASE_URL=file:/app/data/dev.db`

### 2) Run with docker compose

Create `docker-compose.yaml` (or use the one in this repo and adjust paths/tags):

```yaml
services:
  fitness-habit-tracker:
    image: ghcr.io/rellerton/fitness-habit-tracker:v1.0.1
    container_name: fitness-habit-tracker
    restart: unless-stopped
    ports:
      - "3010:3000"   # host:container (change host port if you want)
    environment:
      NODE_ENV: production
      DATABASE_URL: file:/app/data/dev.db
    volumes:
      - /volume1/docker/fitness-habit-tracker/data:/app/data
