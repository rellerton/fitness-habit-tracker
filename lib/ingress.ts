export function getIngressBasePath(): string {
  if (typeof window === "undefined") return "";

  const p = window.location.pathname;

  // HA ingress looks like: /api/hassio_ingress/<token>/...
  const m = p.match(/^(\/api\/hassio_ingress\/[^/]+)/);
  return m ? m[1] : "";
}

export function apiUrl(path: string): string {
  // path should start with "/api/..."
  const base = getIngressBasePath();
  return `${base}${path}`;
}
