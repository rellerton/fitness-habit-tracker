export function apiUrl(path: string) {
  const p = path.startsWith("/") ? path : `/${path}`;

  if (typeof window === "undefined") return p;

  // Home Assistant injects this globally
  const ingress = (window as any).__INGRESS_PATH__;
  if (typeof ingress === "string" && ingress.length > 0) {
    return `${ingress}${p}`;
  }

  return p;
}
