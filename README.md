# Fitness Habit Tracker

A lightweight, self-hosted habit tracker built with Next.js and Prisma using a local SQLite database. Runs as a Home Assistant add-on (Ingress) or as a standard Docker container.

## What it does

- Track habits by person with one or more active trackers
- Define global tracker types (for example, `Default`, `Kids Tracker`, `Nutrition`)
- Manage categories per tracker type (same category workflows, now scoped by type)
- Organize tracking into 4-week or 8-week rounds per tracker
- Preserve historical rounds when a tracker is removed from a person
- Visual Round Wheel for fast daily checkoffs

## Install in Home Assistant (Ingress)

1. Open Home Assistant and go to Settings -> Add-ons -> Add-on Store.
2. Open the menu (top right) -> Repositories -> add:
   `https://github.com/rellerton/fitness-habit-tracker/`
3. Find "Fitness Habit Tracker" in the add-on store and click Install.
4. Start the add-on.
5. Open it from the add-on page or the sidebar (Ingress).

Data is stored under `/data` in Home Assistant. The default database is:
- `database_url`: `file:/data/dev.db`

### Direct access (optional)

The Add On is configured to expose a port for direct access. You can open it directly:
- `http://<HA_HOST>:3000/`

This is useful for iframe dashboards where ingress tokens change.

## How to use

1. Open **Admin** to add people.
2. In **Tracker Types & Categories**, create tracker types and their categories.
3. Go to **People**, open a person, and add one or more trackers.
4. Select a tracker and start a new round to begin tracking.

### Existing installs (upgrade behavior)

When upgrading to `v3.0.0`, existing data is migrated into a `Default` tracker type model:

- Existing categories are moved under the `Default` tracker type.
- Each person gets a `Default` tracker.
- Existing rounds are linked to that person's `Default` tracker.

### Dashboard-friendly view

To show just a person's current round without the control header, open the person page and add `?controls=0`:

```
http://<host>/people/<personId>?controls=0
```

## Updating

- Home Assistant: update the add-on from the add-on store.

## Additional Docs

- Docker install guide: [`docs/docker-install.md`](docs/docker-install.md)
- Development runbook (DB backup/switching + API smoke tests): [`docs/development.md`](docs/development.md)

## Tech stack

- Next.js (App Router)
- Prisma ORM
- SQLite
- Docker / GHCR image publishing via GitHub Actions
