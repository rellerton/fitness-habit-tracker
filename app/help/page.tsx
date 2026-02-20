"use client";

import Link from "next/link";
import { joinIngressPath, useIngressPrefix } from "@/lib/ingress";
import { HELP_SECTIONS, QUICK_START_STEPS } from "@/lib/help-content";

export default function HelpPage() {
  const ingressPrefix = useIngressPrefix();
  const homeHref = (() => {
    const href = joinIngressPath(ingressPrefix, "/");
    return href.endsWith("/") ? href : `${href}/`;
  })();

  return (
    <main className="mx-auto max-w-5xl px-5 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-100">Help</h1>
          <p className="mt-1 text-sm text-slate-400">
            Setup and usage reference for Fitness Habit Tracker.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={joinIngressPath(ingressPrefix, "/people")}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-slate-100 hover:bg-white/10"
          >
            People
          </Link>
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

      <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-100">Quick Start</h2>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-300">
          {QUICK_START_STEPS.map((step, idx) => (
            <li key={`quick-${idx}`}>{step}</li>
          ))}
        </ol>
      </section>

      <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5 shadow-sm">
        {HELP_SECTIONS.map((section) => (
          <section
            key={section.id}
            className="border-t border-white/10 py-4 first:border-t-0 first:pt-0 last:pb-0"
          >
            <h2 className="text-base font-semibold text-slate-100">{section.title}</h2>
            <p className="mt-1 text-sm text-slate-400">{section.intro}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">
              {section.items.map((item, idx) => (
                <li key={`${section.id}-${idx}`}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
