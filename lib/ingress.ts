export function apiUrl(path: string) {
  const p = path.startsWith("/") ? path : `/${path}`;

  if (typeof window === "undefined") return p;

  const loc = window.location.pathname;

  // Supervisor-style ingress UI
  const m1 = loc.match(/^\/hassio\/ingress\/[^/]+/);
  if (m1) return `${m1[0]}${p}`;

  // Raw token-style ingress
  const m2 = loc.match(/^\/api\/hassio_ingress\/[^/]+/);
  if (m2) return `${m2[0]}${p}`;

  return p;
}
