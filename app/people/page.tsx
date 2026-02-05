"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiUrl, joinIngressPath, useIngressPrefix } from "@/lib/ingress";

type Person = { id: string; name: string };

export default function PeoplePage() {
  const ingressPrefix = useIngressPrefix();
  const homeHref = (() => {
    const href = joinIngressPath(ingressPrefix, "/");
    return href.endsWith("/") ? href : `${href}/`;
  })();

  const [people, setPeople] = useState<Person[]>([]);
  const [sidebarCopiedId, setSidebarCopiedId] = useState<string | null>(null);

  async function refresh() {
    const p = await fetch(apiUrl("people")).then((r) => r.json());
    setPeople(p);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function copySidebarUrl(personId: string) {
    const path = joinIngressPath(ingressPrefix, `/people/${personId}`);
    const url = typeof window !== "undefined" ? `${window.location.origin}${path}` : path;

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else if (typeof document !== "undefined") {
        const input = document.createElement("textarea");
        input.value = url;
        input.style.position = "fixed";
        input.style.left = "-9999px";
        document.body.appendChild(input);
        input.focus();
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
      }

      setSidebarCopiedId(personId);
      window.setTimeout(() => setSidebarCopiedId((prev) => (prev === personId ? null : prev)), 1500);
    } catch (error) {
      console.error("Failed to copy sidebar URL:", error);
      alert("Failed to copy sidebar URL.");
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-5 py-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-100">
            People
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Pick a person to view or start their tracking round.
          </p>
        </div>

        <div className="flex gap-2">
          <Link
            href={joinIngressPath(ingressPrefix, "/admin")}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-slate-100 hover:bg-white/10"
          >
            Admin
          </Link>
          <a
            href={homeHref}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-slate-100 hover:bg-white/10"
          >
            Home
          </a>
        </div>
      </div>

      {/* List */}
      <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-2 shadow-sm">
        <ul className="divide-y divide-white/10">
          {people.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-white/5">
              <Link
                href={joinIngressPath(ingressPrefix, `/people/${p.id}`)}
                className="min-w-0 flex-1"
              >
                <div className="truncate text-sm font-medium text-slate-100">
                  {p.name}
                </div>
                <div className="text-xs text-slate-500">{p.id.slice(0, 8)}</div>
              </Link>
              <button
                onClick={() => copySidebarUrl(p.id)}
                className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-100 hover:bg-white/10"
                title="Copy sidebar URL"
                aria-label="Copy sidebar URL"
              >
                {sidebarCopiedId === p.id ? (
                  <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
                    <path
                      fill="currentColor"
                      d="M7.75 13.25 4.5 10l1.2-1.2 2.05 2.05 6.6-6.6L15.5 5.4z"
                    />
                  </svg>
                ) : (
                  <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
                    <path
                      fill="currentColor"
                      d="M6.5 2.5h7a2 2 0 0 1 2 2V12a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2V4.5a2 2 0 0 1 2-2Zm0 1.5a.5.5 0 0 0-.5.5V12a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 .5-.5V4.5a.5.5 0 0 0-.5-.5h-7ZM3.5 6a2 2 0 0 1 2-2v1.5h-2a.5.5 0 0 0-.5.5v7a.5.5 0 0 0 .5.5H10.5V15h-7a2 2 0 0 1-2-2V6Z"
                    />
                  </svg>
                )}
              </button>
            </li>
          ))}

          {people.length === 0 && (
            <li className="px-4 py-8 text-sm text-slate-400">
              No people yet. Add one from the Admin page.
            </li>
          )}
        </ul>
      </section>
    </main>
  );
}
