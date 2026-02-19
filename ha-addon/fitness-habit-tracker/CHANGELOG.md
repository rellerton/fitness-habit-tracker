# Changelog

## v3.0.1

- Person UI: prevent brief tracker-selector flash while loading the initial active tracker/round state.

## v3.0.0

- Major feature: add global `Tracker Types` and person-level `Trackers` (one or more active trackers per person).
- Categories now belong to a tracker type (same category workflows, now scoped per tracker type).
- Backward-compatible data migration: existing data is backfilled into a `Default` tracker type/tracker structure.
- Rounds now run within a selected tracker, while preserving existing round behavior.
- Round numbering now scopes by tracker type per person (for example, first round in a new tracker type is `Round 1`).
- Person UI: active tracker selection/creation flow cleaned up for common single-tracker use, with multi-tracker support.
- Admin UI: tracker-type management, per-type category management, tracker visibility/removal controls, and clearer rounds-by-tracker context.
- Confirmation prompts updated for clarity on destructive actions (person + tracker + round context where relevant).

## v2.1.5

- Summary: cap per-week category scoring to avoid over-crediting missed days.
- Summary: refresh layout styling and spacing for active-round summary.

## v2.1.4

- Active round: add completed-weeks summary panel with cleaner layout.
- RoundWheel: improve global click-to-dismiss for week progress.

## v2.1.3

- RoundWheel: clicking anywhere dismisses the week progress popup.
- RoundWheel: improve weight icon target size and add weight actions in the mobile week overlay.
- Weights: refine mobile week overlay actions and weight icon hit target.

## v2.1.2

- RoundWheel: improve weight icon click target.

## v2.1.1

- Build: fix weight API type check for production build.

## v2.1.0

- Weights: add weekly weight tracking per round with editable per-week entries.
- Weights: show weight value in week headers and tooltips, plus in the mobile week overlay.
- Weights: new compact weight-by-week chart with goal line support (active + history).
- Rounds: add optional goal weight when starting or editing a round.
- Settings: add App Settings for weight units (Lbs/Kg) and use the selected unit in charts and labels.

## v2.0.4

- UI: remove “copy sidebar URL” actions (ingress links were unreliable).
- Categories: delete modal can remove category data from active rounds.

## v2.0.3

- RoundWheel: slightly reduce glyph size in thinner rings (better at 5 categories).
- UI: add “copy sidebar URL” action per person on Home and People pages.

## v2.0.2

- Categories: add “apply to latest rounds” option for new categories and name edits.

## v2.0.1

- People: edit and delete persons (delete cascades all their rounds and entries).
- Rounds: unify the start-round modal so 4/8-week selection appears for new and existing people.
- UI: dark-theme the start-round date picker.

## v2.0.0

- Rounds: choose 4-week or 8-week length when starting a new round (default 8).
- Person page: add “Edit Start Date” modal to shift all entries in the active round.
- Categories: enforce max 5 active categories (UI + API) and show messaging when at limit.
- Categories: add edit (rename) modal and soft-delete (inactive) behavior; re-adding a name reactivates it.
- Categories: new `allowDaysOffPerWeek` setting (0–5) with admin UI + API validation.
- Database: new Category column `allowDaysOffPerWeek` with default 0 via migration.
- History table: % complete now accounts for allowed days off per week and caps at 100%.
- RoundWheel: per-week progress dashes for all weeks, plus week label hover/tap tooltip with per-category mini bars.
- Admin UI: dark-themed select styling for days-off dropdowns.
- UI: align modal/admin/roundwheel surfaces with Home Assistant dark background.

## v1.1.19

- Person page: add "Edit Start Date" modal that shifts all entries in the active round.
- Add-on: custom store icon (`logo.png`) replaces the default puzzle piece.

## v1.1.18

- Mobile round wheel: tap to open a week overlay with all categories and weekday labels.
- Overlay now centers on screen and scrolls within a capped height for phones.

## v1.1.17

- Add conditional `./_next` rewrite for direct access without affecting ingress.

## v1.1.16

- Revert to the v1.1.8 ingress-stable configuration and remove base href injection.

## v1.1.15

- Fix layout header access for Next async headers API.

## v1.1.14

- Force dynamic rendering for layout to allow ingress header inspection.

## v1.1.13

- Add base href derived from ingress header to fix direct access asset paths.
- Forward ingress path header from nginx for server-side base URL detection.

## v1.1.12

- Revert asset prefix removal to restore ingress stability.

## v1.1.11

- Remove `NEXT_PUBLIC_ASSET_PREFIX` so direct access uses absolute `/_next` assets.
- Keep ingress rewrites intact to preserve sidebar/Open Web UI routing.

## v1.1.10

- Revert Previous Changes

## v1.1.9

- Limit ingress sub_filter rewrites to HTML to avoid client-side routing issues.
- Rewrite relative `./_next` URLs in HTML so direct access loads assets correctly.

## v1.1.8

- Detect ingress prefix for HA sidebar and `/hassio/ingress` URL formats.
- Keep nested `/_next` normalization while removing the problematic `./_next` rewrite.

## v1.1.7

- Fix ingress asset routing for nested pages by normalizing `/_next` requests.
- Rewrite relative `./_next` asset URLs to the ingress prefix to prevent chunk 404s.

## v1.1.6

- Fix ingress prefix initialization so links/rendered routes are correct on first paint.
- Home links now force full navigation with trailing slash to avoid 404s in ingress.

## v1.1.5

- Ingress detection updated to support HA sidebar URL format and reduce route flakiness.
- Initial ingress prefix resolves earlier to avoid mismatched links/requests on first render.

## v1.1.4

- Round wheel: add label slice and centered person + round text for clarity.
- UI: update background to match Home Assistant dark dashboards.
- Home page: list people for direct navigation (removed separate People button).
- Add-on: expose direct access port and improve iframe compatibility.
