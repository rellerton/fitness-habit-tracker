"use client";

import Link, { LinkProps } from "next/link";
import { ReactNode } from "react";

function ingressPrefix(): string {
  if (typeof window === "undefined") return "";
  const m = window.location.pathname.match(/^\/api\/hassio_ingress\/[^/]+/);
  return m ? m[0] : "";
}

type Props = LinkProps & {
  children: ReactNode;
  className?: string;
};

export default function IngressLink({ href, children, ...rest }: Props) {
  const prefix = ingressPrefix();

  // Only rewrite internal string hrefs that start with "/"
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
