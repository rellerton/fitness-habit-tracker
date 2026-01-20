# Changelog

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
