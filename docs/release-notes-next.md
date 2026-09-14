# Next release notes (draft)

These notes describe changes merged after `v3.2.2`. They are a draft for the
next version and do not publish or assign a version number.

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

## Upgrade notes

- Back up the add-on before upgrading.
- No new database migration is introduced by these changes.
- The first multi-architecture release should be verified on real ARM64 Home
  Assistant hardware before broad rollout.
- Direct port access remains unauthenticated and should stay restricted to a
  trusted network.

## Release checklist

- [ ] Choose and apply the next semantic version in add-on metadata/changelog.
- [ ] Verify GitHub Actions on the release commit.
- [ ] Build and inspect the published amd64/arm64 manifest.
- [ ] Test install/upgrade and backup/restore in an isolated Supervisor lab.
- [ ] Test the ARM64 image on real hardware.
- [ ] Create a GitHub Release using generated notes and this draft.
- [ ] Coordinate and explicitly approve the production add-on upgrade.
