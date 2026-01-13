"use client";

import React from "react";

type Item = {
  glyph: string;
  label: string;
  hint?: string;
  glyphClass: string;
  swatchClass?: string; // optional little color chip
};

const items: Item[] = [
  {
    glyph: "✓",
    label: "Done",
    hint: "Completed",
    glyphClass: "text-emerald-300",
    swatchClass: "bg-emerald-500/30 ring-emerald-400/30",
  },
  {
    glyph: "½",
    label: "Half",
    hint: "Partial / 50%",
    glyphClass: "text-emerald-200",
    swatchClass: "bg-emerald-500/20 ring-emerald-400/25",
  },
  {
    glyph: "X",
    label: "Off",
    hint: "Skipped / Off day",
    glyphClass: "text-red-300",
    swatchClass: "bg-slate-500/10 ring-white/10",
  },
  {
    glyph: "*",
    label: "Treat",
    hint: "Treat meal",
    glyphClass: "text-orange-200",
    swatchClass: "bg-orange-500/25 ring-orange-400/25",
  },
  {
    glyph: "S",
    label: "Sick",
    hint: "Sick day",
    glyphClass: "text-orange-200",
    swatchClass: "bg-orange-500/25 ring-orange-400/25",
  },
];

export default function StatusLegend() {
  return (
    <div className="mt-4 w-full max-w-[900px] mx-auto">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-slate-200">Status legend</div>
            <div className="text-xs text-slate-400">Tap a wedge to cycle through these</div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {items.map((it) => (
            <div
              key={it.glyph}
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/30 px-3 py-2"
            >
              <div
                className={[
                  "flex h-9 w-9 items-center justify-center rounded-lg ring-1",
                  it.swatchClass ?? "bg-white/5 ring-white/10",
                ].join(" ")}
                aria-hidden="true"
              >
                <span className={["text-lg font-black", it.glyphClass].join(" ")}>{it.glyph}</span>
              </div>

              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-200">{it.label}</div>
                {it.hint && <div className="text-xs text-slate-400">{it.hint}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
