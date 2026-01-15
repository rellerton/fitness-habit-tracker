export function apiUrl(path: string) {
  const p = path.startsWith("/") ? path : `/${path}`;

  // Server-side safety (shouldn't be used server-side, but don't explode)
  if (typeof window === "undefined") return p;

  // HA ingress lives under:
  // /api/hassio_ingress/<TOKEN>/...
  const m = window.location.pathname.match(/^\/api\/hassio_ingress\/[^/]+/);
  if (!m) return p;

  return `${m[0]}${p}`;
}
