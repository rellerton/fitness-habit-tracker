export function apiUrl(path: string) {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (typeof window === "undefined") return p;

  const ingress = (window as any).__INGRESS_PATH__;
  if (typeof ingress === "string" && ingress.length > 0 && ingress !== "/") {
    return `${ingress}${p}`;
  }

  // fallback: try to detect
  const m = window.location.pathname.match(
    /^\/(?:hassio\/ingress|api\/hassio_ingress)\/[^/]+/
  );

  return m ? `${m[0]}${p}` : p;
}
