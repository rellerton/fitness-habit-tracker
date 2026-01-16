# Changelog

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
