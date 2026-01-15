"use client";

import Link, { LinkProps } from "next/link";
import { ReactNode } from "react";

function getIngressPrefix(): string {
  if (typeof window === "undefined") return "";

  const p = window.location.pathname;

  // Supervisor-style ingress UI
  // /hassio/ingress/<slug>/...
  const m1 = p.match(/^\/hassio\/ingress\/[^/]+/);
  if (m1) return m1[0];

  // Raw token-style ingress
  // /api/hassio_ingress/<token>/...
  const m2 = p.match(/^\/api\/hassio_ingress\/[^/]+/);
  if (m2) return m2[0];

  return "";
}

type Props = LinkProps & {
  children: ReactNode;
  className?: string;
};

export default function IngressLink({ href, children, ...rest }: Props) {
  const prefix = getIngressPrefix();

  if (typeof href === "string" && href.startsWith("/") && prefix) {
    return (
      <Link href={`${prefix}${href}`} {...rest}>
        {children}
      </Link>
    );
  }

  return (
    <Link href={href} {...rest}>
      {children}
    </Link>
  );
}
