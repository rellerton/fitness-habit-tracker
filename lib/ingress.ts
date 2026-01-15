function detectIngressPrefix(pathname: string): string {
  const m2 = pathname.match(/^\/api\/hassio_ingress\/[^/]+/);
  if (m2) return m2[0];

  const m1 = pathname.match(/^\/hassio\/ingress\/[^/]+/);
  if (m1) return m1[0];

  return "";
}

export function apiUrl(path: string) {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (typeof window === "undefined") return p;

  const prefix = detectIngressPrefix(window.location.pathname);
  return prefix ? `${prefix}${p}` : p;
}
