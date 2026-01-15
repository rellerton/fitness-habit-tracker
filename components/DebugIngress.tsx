"use client";

import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/ingress";

export default function DebugIngress() {
  const [txt, setTxt] = useState("loading...");

  useEffect(() => {
    setTxt(
      [
        `pathname: ${window.location.pathname}`,
        `origin: ${window.location.origin}`,
        `__INGRESS_PATH__: ${String((window as any).__INGRESS_PATH__ ?? "undefined")}`,
        `api(/api/people): ${apiUrl("/api/people")}`,
      ].join("\n")
    );
  }, []);

  return (
    <pre
      style={{
        position: "fixed",
        top: 10,
        left: 10,
        right: 10,
        zIndex: 99999,
        padding: 12,
        borderRadius: 10,
        background: "rgba(255,255,255,0.95)",
        color: "#000",
        fontSize: 12,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        border: "2px solid red",
        maxWidth: 600,
      }}
    >
      {txt}
    </pre>
  );
}
