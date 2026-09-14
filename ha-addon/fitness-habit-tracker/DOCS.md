# Fitness Habit Tracker add-on

Fitness Habit Tracker is a self-hosted habit and weight tracker for households. It runs locally in Home Assistant and stores its SQLite database in the add-on data directory.

## Installation

1. Install the add-on from its Home Assistant add-on repository.
2. Start the add-on.
3. Enable **Show in sidebar** if you want a persistent navigation entry.
4. Open **Web UI** to begin setup.

On first start, database migrations run automatically. Existing databases are migrated in place.

## Configuration

### `database_url`

The default is `file:/data/dev.db`. This keeps the SQLite database in Home Assistant's persistent add-on data directory and is the recommended setting.

Changing the path can make the database unavailable to Home Assistant backups. Only change it if you understand the storage and recovery implications.

## First-time setup

1. Open **Admin** and add the people who will use the tracker.
2. Create one or more tracker types and define their categories.
3. Open a person, assign a tracker, and start a four- or eight-week round.
4. Record daily category status and weekly weight from the active round.

## Access

Home Assistant ingress is the normal access method. The add-on also exposes TCP port 3000 for an optional direct URL such as `http://homeassistant.local:3000/`.

Direct access is not protected by Home Assistant ingress authentication. Do not expose port 3000 to the public internet. If direct access is unnecessary, clear its host port assignment on the add-on's **Network** tab.

## Data and backups

All persistent data is stored under `/data`. Home Assistant is asked to stop the add-on for backups so SQLite is not copied while database writes are in progress.

Restore the add-on and its data together from a Home Assistant backup. For a manual database copy, stop the add-on before copying `/data/dev.db` and its SQLite sidecar files.

## Updating

Create a Home Assistant backup before updating. The add-on applies Prisma database migrations during startup, so downgrading to an older version may not be supported after a schema migration.

## Troubleshooting

- Check the add-on log if startup fails. A healthy start ends with Next.js listening on port 3001 and Nginx listening on port 3000.
- If the UI opens but assets fail to load, reload the ingress panel once to clear stale HTML.
- If the readiness endpoint reports an error, verify the configured database URL and available disk space.
- Health endpoint: `/api/health`
- Database readiness endpoint: `/api/ready`
- The container deliberately exits if either Next.js or Nginx stops. Home
  Assistant's watchdog can then report the failure and restart the add-on.

When reporting a problem, include the add-on version, Home Assistant version, host architecture, and relevant log lines. Remove ingress tokens, URLs containing ingress paths, and other private values before sharing logs.
