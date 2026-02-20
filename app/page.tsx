"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiUrl, joinIngressPath, useIngressPrefix } from "@/lib/ingress";
import { QUICK_START_STEPS } from "@/lib/help-content";

type Person = { id: string; name: string };

export default function Home() {
  const ingressPrefix = useIngressPrefix();
  const [people, setPeople] = useState<Person[]>([]);
  const [loadingPeople, setLoadingPeople] = useState(true);

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

  return (
    <main className="mx-auto max-w-4xl px-5 py-16">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-sm">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-100">
          Fitness Habit Tracker
        </h1>

        <p className="mt-3 max-w-xl text-sm text-slate-400">
          Track daily habits across multiple categories using a circular grid in 4 or 8 week
          rounds. Start by setting up people, trackers, and categories, then jump into an active
          round.
        </p>

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
                  <Link
                    href={joinIngressPath(ingressPrefix, `/people/${person.id}`)}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-100 hover:bg-white/10"
                  >
                    <span className="truncate">{person.name}</span>
                    <span className="text-xs text-slate-500">{person.id.slice(0, 8)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={joinIngressPath(ingressPrefix, "/admin")}
            className="inline-flex items-center justify-center rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-400"
          >
            Admin
          </Link>
          <Link
            href={joinIngressPath(ingressPrefix, "/help")}
            className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-slate-100 hover:bg-white/10"
          >
            Help
          </Link>
        </div>

        <div className="mt-8 border-t border-white/10 pt-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-100">Quick Start</h2>
              <p className="mt-1 text-sm text-slate-400">Most users can be up and running in under 2 minutes.</p>
            </div>
            <Link
              href={joinIngressPath(ingressPrefix, "/help")}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-white/10"
            >
              Full help
            </Link>
          </div>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-300">
            {QUICK_START_STEPS.map((step, idx) => (
              <li key={`quick-home-${idx}`}>{step}</li>
            ))}
          </ol>
        </div>
      </div>
    </main>
  );
}
