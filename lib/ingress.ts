export function apiUrl(path: string) {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (typeof window === "undefined") return p;

  // HA addon ingress can be either:
  // 1) /hassio/ingress/<slug>/...
  // 2) /api/hassio_ingress/<token>/...
  const m = window.location.pathname.match(
    /^\/(?:hassio\/ingress|api\/hassio_ingress)\/[^/]+/
  );

  if (!m) return p;
  return `${m[0]}${p}`;
}