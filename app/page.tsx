"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiUrl, joinIngressPath, useIngressPrefix } from "@/lib/ingress";

type Person = { id: string; name: string };

export default function Home() {
  const ingressPrefix = useIngressPrefix();
  const [people, setPeople] = useState<Person[]>([]);
  const [loadingPeople, setLoadingPeople] = useState(true);
  const [sidebarCopiedId, setSidebarCopiedId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadPeople() {
      try {
        const res = await fetch(apiUrl("people"));
        const data = await res.json().catch(() => []);
        if (!active) return;
        setPeople(Array.isArray(data) ? data : []);
      } catch (error) {
        if (!active) return;
        console.error("[Home] Failed to load people:", error);
        setPeople([]);
      } finally {
        if (!active) return;
        setLoadingPeople(false);
      }
    }

    loadPeople();
    return () => {
      active = false;
    };
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
    <main className="mx-auto max-w-4xl px-5 py-16">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-sm">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-100">
          Fitness Habit Tracker
        </h1>

        <p className="mt-3 max-w-xl text-sm text-slate-400">
          Track daily habits across multiple categories using a circular grid in 4 or 8 week
          rounds. Start by setting up people and categories, then jump into a person's active
          round.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={joinIngressPath(ingressPrefix, "/admin")}
            className="inline-flex items-center justify-center rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-400"
          >
            Admin
          </Link>
        </div>

        <div className="mt-8 border-t border-white/10 pt-6">
          <h2 className="text-base font-semibold text-slate-100">People</h2>
          <p className="mt-1 text-sm text-slate-400">
            Jump straight into a person’s current round.
          </p>

          {loadingPeople ? (
            <p className="mt-4 text-sm text-slate-400">Loading people...</p>
          ) : people.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">
              No people yet. Add your first person in Admin.
            </p>
          ) : (
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {people.map((person) => (
                <li key={person.id}>
                  <div className="group flex items-center rounded-xl border border-white/10 bg-white/5 transition-colors hover:bg-white/10 divide-x divide-white/10">
                    <Link
                      href={joinIngressPath(ingressPrefix, `/people/${person.id}`)}
                      className="min-w-0 flex-1 px-4 py-3"
                    >
                      <div className="truncate text-sm font-medium text-slate-100">
                        {person.name}
                      </div>
                      <div className="text-xs text-slate-500">{person.id.slice(0, 8)}</div>
                    </Link>
                    <button
                      onClick={() => copySidebarUrl(person.id)}
                      className="px-3 py-3 text-slate-100 hover:bg-white/10"
                      title="Copy sidebar URL"
                      aria-label="Copy sidebar URL"
                    >
                      {sidebarCopiedId === person.id ? (
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
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
