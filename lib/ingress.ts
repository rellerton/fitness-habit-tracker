import { useEffect, useState } from "react";

function getIngressPrefixFromPath(pathname: string) {
  const match = pathname.match(/^\/api\/hassio_ingress\/[^/]+/);
  return match ? match[0] : "";
}

export function getIngressPrefix() {
  if (typeof window === "undefined") return "";
  return getIngressPrefixFromPath(window.location.pathname);
}

export function joinIngressPath(prefix: string, path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (!prefix) return normalized;
  return `${prefix}${normalized}`;
}

export function apiUrl(path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const withApi = normalized.startsWith("/api/") ? normalized : `/api${normalized}`;
  return joinIngressPath(getIngressPrefix(), withApi);
}

export function useIngressPrefix() {
  const [prefix, setPrefix] = useState("");

  useEffect(() => {
    setPrefix(getIngressPrefix());
  }, []);

  return prefix;
}
