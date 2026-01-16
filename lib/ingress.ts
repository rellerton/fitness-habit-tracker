import { useEffect, useState } from "react";

function getIngressPrefixFromPath(pathname: string) {
  const patterns = [
    /^\/api\/hassio_ingress\/[^/]+/,
    /^\/hassio\/ingress\/[^/]+/,
    /^\/[a-f0-9]+_[^/]+\/ingress/i,
  ];

  for (const pattern of patterns) {
    const match = pathname.match(pattern);
    if (match) return match[0];
  }

  return "";
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
  const [prefix, setPrefix] = useState(() =>
    typeof window === "undefined" ? "" : getIngressPrefix()
  );

  useEffect(() => {
    setPrefix(getIngressPrefix());
  }, []);

  return prefix;
}
