# v3.3.1

## Family Hub compatibility hotfix

- Restores Nginx rewriting for JavaScript responses so direct nested tracker
  pages can resolve Next.js runtime assets and hydrate instead of remaining on
  `Loading tracker...`.
- Targets the Chromium 85 feature set used by the previously working build,
  avoiding a newer class-static-block construct emitted by Next.js 16.3.
- Runs the full desktop and mobile browser suite through the Home Assistant
  Nginx wrapper, and adds focused regressions for both JavaScript asset-base
  rewriting and the Family Hub syntax ceiling.

## v3.3.0

This is the first full GitHub Release for Fitness Habit Tracker. It collects the
application, add-on, reliability, and project improvements merged after
`v3.2.2`.

## Highlights

- Updated Next.js and transitive packages to remove known audit findings.
- Added amd64/aarch64 image publishing, Supervisor documentation, an add-on
  icon, and cold SQLite backups.
- Removed ingress debug-path disclosure and sensitive startup logging.
- Made the add-on stop when either Nginx or Next.js exits so Supervisor can
  recover it.
- Applied targeted cache rules and limited ingress response rewriting to HTML.
- Fixed round start-date edits so daily entries and weekly weights move together
  across both daylight-saving transitions.
- Added strict API ownership, date, mode, string-length, integer, and numeric
  validation.
- Expanded CI with API, ingress, process-supervision, migration, backup/restore,
  concurrency, accessibility, and responsive-browser checks.
- Added weekly Dependabot updates, a production-only npm audit, high/critical
  container vulnerability gates, and Node.js 24 GitHub Actions.
- Reduced published images to production dependencies and removed npm tooling
  from the runtime layer.

## Upgrade notes

- Back up the add-on before upgrading.
- No new database migration is introduced by these changes.
- The first multi-architecture release should be verified on real ARM64 Home
  Assistant hardware before broad rollout.
- Direct port access remains unauthenticated and should stay restricted to a
  trusted network.

## Validation

- Production dependency auditing, lint, type checking, the production build,
  database integrity, API, ingress, process-supervision, accessibility, and
  responsive-browser tests are enforced by CI.
- Standard and Home Assistant images are blocked from release when Trivy finds
  a fixed high or critical operating-system or application dependency issue.
- The published images target both amd64 and arm64. Real ARM64 hardware remains
  a recommended post-release acceptance check.

Production is not upgraded by publishing this release; install it only after a
separate, explicit production approval.
