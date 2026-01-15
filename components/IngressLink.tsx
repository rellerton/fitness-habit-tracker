"use client";

import Link, { LinkProps } from "next/link";
import { ReactNode, useEffect, useMemo, useState } from "react";

function detectIngressPrefix(pathname: string): string {
  // /api/hassio_ingress/<token>/...
  const m2 = pathname.match(/^\/api\/hassio_ingress\/[^/]+/);
  if (m2) return m2[0];

  // /hassio/ingress/<slug>/...
  const m1 = pathname.match(/^\/hassio\/ingress\/[^/]+/);
  if (m1) return m1[0];

  return "";
}

type Props = LinkProps & {
  children: ReactNode;
  className?: string;
};

export default function IngressLink({ href, children, ...rest }: Props) {
  const [prefix, setPrefix] = useState<string>("");

  useEffect(() => {
    setPrefix(detectIngressPrefix(window.location.pathname));
  }, []);

  const resolvedHref = useMemo(() => {
    if (typeof href !== "string") return href;
    if (!href.startsWith("/")) return href;
    if (!prefix) return href;
    return `${prefix}${href}`;
  }, [href, prefix]);

  // Important: suppressHydrationWarning prevents Next from freaking out about
  // server HTML having /admin and client switching to /api/hassio_ingress/.../admin
  return (
    <Link href={resolvedHref as any} {...rest} suppressHydrationWarning>
      {children}
    </Link>
  );
}
