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

  async function refresh() {
    const p = await fetch(apiUrl("people")).then((r) => r.json());
    setPeople(p);
  }

  useEffect(() => {
    refresh();
  }, []);

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
            <li key={p.id}>
              <Link
                href={joinIngressPath(ingressPrefix, `/people/${p.id}`)}
                className="group flex items-center justify-between gap-3 rounded-xl px-4 py-3 hover:bg-white/5"
              >
                <span className="font-medium text-slate-100 group-hover:text-white">
                  {p.name}
                </span>
                <span className="text-xs text-slate-400">
                  {p.id.slice(0, 8)}
                </span>
              </Link>
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
