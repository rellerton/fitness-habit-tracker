export function apiUrl(path: string) {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (typeof window === "undefined") return p;

  // Prefer HA-provided ingress base if present
  const ingress = (window as any).__INGRESS_PATH__;
  if (typeof ingress === "string" && ingress.length > 0) {
    return `${ingress}${p}`;
  }

  // Fallback: detect both HA ingress path styles
  const m = window.location.pathname.match(
    /^\/(?:hassio\/ingress|api\/hassio_ingress)\/[^/]+/
  );
  if (!m) return p;

  return `${m[0]}${p}`;
}
