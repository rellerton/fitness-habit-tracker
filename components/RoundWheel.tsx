"use client";

import React, { useMemo } from "react";

type Category = { categoryId: string; displayName: string };

export type RoundWheelEntry = {
  categoryId: string;
  date: string; // YYYY-MM-DD or ISO
  status: string; // EMPTY/HALF/DONE/OFF/TREAT/SICK
};

type Props = {
  roundId: string;
  roundNumber: number;
  personName?: string | null;
  startDate: string;
  lengthWeeks: number;
  categories: Category[];
  entries: RoundWheelEntry[];
  onCellClick: (roundId: string, categoryId: string, day: string) => void;
  size?: number;
};

function formatDate(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseLocalDay(s: string) {
  const ymd = String(s).slice(0, 10);
  const d = new Date(`${ymd}T00:00:00`);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${s}`);
  return d;
}

function formatMMDD(yyyyMMdd: string) {
  return `${yyyyMMdd.slice(5, 7)}/${yyyyMMdd.slice(8, 10)}`;
}

function polar(cx: number, cy: number, r: number, angleRad: number) {
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
}

function annularSectorPath(
  cx: number,
  cy: number,
  rInner: number,
  rOuter: number,
  a0: number,
  a1: number
) {
  const p0 = polar(cx, cy, rOuter, a0);
  const p1 = polar(cx, cy, rOuter, a1);
  const p2 = polar(cx, cy, rInner, a1);
  const p3 = polar(cx, cy, rInner, a0);

  const largeArc = a1 - a0 > Math.PI ? 1 : 0;

  return [
    `M ${p0.x} ${p0.y}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${p1.x} ${p1.y}`,
    `L ${p2.x} ${p2.y}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${p3.x} ${p3.y}`,
    "Z",
  ].join(" ");
}

function arcPath(cx: number, cy: number, r: number, a0: number, a1: number) {
  const p0 = polar(cx, cy, r, a0);
  const p1 = polar(cx, cy, r, a1);
  const largeArc = a1 - a0 > Math.PI ? 1 : 0;

  return `M ${p0.x} ${p0.y} A ${r} ${r} 0 ${largeArc} 1 ${p1.x} ${p1.y}`;
}

function statusGlyph(status: string) {
  switch (status) {
    case "DONE":
      return "✓";
    case "HALF":
      return "½";
    case "OFF":
      return "X";
    case "TREAT":
      return "*";
    case "SICK":
      return "S";
    default:
      return "";
  }
}

/**
 * Ring palette: cohesive with dark slate UI.
 * Status colors override when needed (DONE/SICK/TREAT).
 */
const RING_COLORS: Array<[number, number, number]> = [
  [56, 189, 248], // sky
  [45, 212, 191], // teal
  [167, 139, 250], // violet
  [251, 191, 36], // amber-ish
  [148, 163, 184], // slate
];

function rgba(rgb: [number, number, number], a: number) {
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
}

function ringRGB(ringIdx: number): [number, number, number] {
  return RING_COLORS[ringIdx % RING_COLORS.length];
}

function ringStroke(ringIdx: number) {
  return rgba(ringRGB(ringIdx), 0.28);
}

// Lighter/cleaner accents
const GREEN_OVERLAY = "rgba(34,197,94,0.55)";
const DONE_FILL = "rgba(34,197,94,0.50)";
const ORANGE_FILL = "rgba(251,146,60,0.48)";

function baseCellFill(ringIdx: number, status: string) {
  const c = ringRGB(ringIdx);

  // Overrides
  if (status === "DONE") return DONE_FILL;
  if (status === "SICK" || status === "TREAT") return ORANGE_FILL;

  // Ring tint baseline (more transparent than before)
  switch (status) {
    case "EMPTY":
      return rgba(c, 0.040);
    case "HALF":
      return rgba(c, 0.055);
    case "OFF":
      return rgba(c, 0.050);
    default:
      return rgba(c, 0.040);
  }
}

function glyphColor(status: string) {
  if (status === "OFF") return "rgba(248,113,113,0.95)"; // red X
  return "rgba(255,255,255,0.92)";
}

export default function RoundWheel({
  roundId,
  roundNumber,
  personName,
  startDate,
  lengthWeeks,
  categories,
  entries,
  onCellClick,
  size = 640,
}: Props) {
  const totalDays = lengthWeeks * 7;
  const labelDays = 7;

  const days = useMemo(() => {
    const start = parseLocalDay(startDate);
    return Array.from({ length: totalDays }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return formatDate(d);
    });
  }, [startDate, totalDays]);


  const entryMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of entries) m.set(`${e.categoryId}|${e.date}`, e.status);
    return m;
  }, [entries]);

  // Local "today" key
  const todayKey = useMemo(() => formatDate(new Date()), []);
  const todayIdx = useMemo(() => {
    const idx = days.indexOf(todayKey);
    return idx >= 0 ? idx : -1;
  }, [days, todayKey]);

  const view = 500;
  const cx = view / 2;
  const cy = view / 2;

  const padding = 16;

  // Outer label band outside the grid
  const labelBand = 32;
  const labelOuter = cx - padding;
  const gridOuter = labelOuter - labelBand;

  const ringGap = 2.0;
  const ringCount = Math.max(1, categories.length);
  const ringThickness = (gridOuter - 78) / ringCount;
  const innerBase = gridOuter - ringCount * ringThickness;

  const totalSegments = totalDays + labelDays;
  const step = (Math.PI * 2) / totalSegments;
  const rotation = -Math.PI / 2 - labelDays * step;

  // Category label slice (fixed angle band, non-clickable)
  const labelSliceStart = rotation;
  const labelSliceEnd = rotation + labelDays * step;

  // Label positions (inside label band)
  const labelMidR = (gridOuter + labelOuter) / 2;
  const dateR = labelMidR - 8;
  const weekR = labelMidR + 7;

  // Today highlight style
  const TODAY_STROKE = "rgba(250,204,21,0.95)"; // amber/yellow
  const TODAY_GLOW = "rgba(250,204,21,0.25)";

  return (
    <div className="w-full">
      <div className="mx-auto w-full max-w-[900px]">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${view} ${view}`}
          className="h-auto w-full select-none"
        >
          {/* Outer label band + grid boundary */}
          <circle
            cx={cx}
            cy={cy}
            r={labelOuter}
            fill="rgba(255,255,255,0.03)"
            stroke="rgba(255,255,255,0.10)"
          />
          <circle
            cx={cx}
            cy={cy}
            r={gridOuter}
            fill="rgba(2,6,23,0.10)"
            stroke="rgba(255,255,255,0.10)"
          />

          {/* Ring boundary strokes */}
          {categories.map((cat, ringIdx) => {
            const rOuter = gridOuter - ringIdx * ringThickness;
            return (
              <circle
                key={`ring-stroke-${cat.categoryId}`}
                cx={cx}
                cy={cy}
                r={rOuter}
                fill="none"
                stroke={ringStroke(ringIdx)}
                strokeWidth={1.15}
              />
            );
          })}

          {/* Label slice boundaries */}
          {[labelSliceStart, labelSliceEnd].map((angle, idx) => {
            const pOut = polar(cx, cy, labelOuter, angle);
            const pIn = polar(cx, cy, innerBase, angle);

            return (
              <line
                key={`label-boundary-${idx}`}
                x1={pIn.x}
                y1={pIn.y}
                x2={pOut.x}
                y2={pOut.y}
                stroke="rgba(255,255,255,0.32)"
                strokeWidth={2.2}
              />
            );
          })}

          {/* Week boundary ticks */}
          {Array.from({ length: lengthWeeks + 1 }, (_, w) => {
            const dayIdx = labelDays + w * 7;
            const angle = rotation + dayIdx * step;

            const pOut = polar(cx, cy, labelOuter, angle);
            const pIn = polar(cx, cy, innerBase, angle);

            return (
              <line
                key={`week-boundary-${w}`}
                x1={pIn.x}
                y1={pIn.y}
                x2={pOut.x}
                y2={pOut.y}
                stroke="rgba(255,255,255,0.26)"
                strokeWidth={w === 0 ? 2.2 : 1.9}
              />
            );
          })}

          {/* Week labels */}
          {Array.from({ length: lengthWeeks }, (_, w) => {
            const midDay = labelDays + w * 7 + 3.5;
            const angle = rotation + midDay * step;
            const pos = polar(cx, cy, weekR, angle);
            const deg = (angle * 180) / Math.PI + 90;

            return (
              <text
                key={`week-label-${w}`}
                x={pos.x}
                y={pos.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={10.5}
                fill="rgba(148,163,184,0.95)"
                style={{ fontWeight: 700, letterSpacing: 0.2 }}
                transform={`rotate(${deg} ${pos.x} ${pos.y})`}
              >
                Week {w + 1}
              </text>
            );
          })}

          {/* Date labels at week starts */}
          {Array.from({ length: lengthWeeks }, (_, w) => {
            const dayIdx = w * 7;
            const day = days[dayIdx];
            if (!day) return null;

            const angle = rotation + (labelDays + dayIdx) * step;
            const pos = polar(cx, cy, dateR, angle);
            const deg = (angle * 180) / Math.PI + 90;

            return (
              <text
                key={`date-label-${w}`}
                x={pos.x}
                y={pos.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={9.5}
                fill="rgba(203,213,225,0.95)"
                style={{ fontWeight: 700 }}
                transform={`rotate(${deg} ${pos.x} ${pos.y})`}
              >
                {formatMMDD(day)}
              </text>
            );
          })}

          {/* ✅ Today highlight (only if today's date is within this round) */}
          {todayIdx >= 0 && (() => {
            const a0 = rotation + (labelDays + todayIdx) * step;
            const a1 = rotation + (labelDays + todayIdx + 1) * step;

            // Outer arc endpoints
            const o0 = polar(cx, cy, gridOuter + 1.2, a0);
            const o1 = polar(cx, cy, gridOuter + 1.2, a1);

            // Inner arc endpoints (at innerBase)
            const i0 = polar(cx, cy, innerBase - 0.8, a0);
            const i1 = polar(cx, cy, innerBase - 0.8, a1);

            const largeArc = a1 - a0 > Math.PI ? 1 : 0;

            return (
              <g key="today-highlight" pointerEvents="none">
                {/* subtle glow ring */}
                <path
                  d={[
                    `M ${o0.x} ${o0.y}`,
                    `A ${gridOuter + 1.2} ${gridOuter + 1.2} 0 ${largeArc} 1 ${o1.x} ${o1.y}`,
                  ].join(" ")}
                  stroke={TODAY_GLOW}
                  strokeWidth={8}
                  fill="none"
                  strokeLinecap="round"
                />

                {/* outer arc */}
                <path
                  d={[
                    `M ${o0.x} ${o0.y}`,
                    `A ${gridOuter + 1.2} ${gridOuter + 1.2} 0 ${largeArc} 1 ${o1.x} ${o1.y}`,
                  ].join(" ")}
                  stroke={TODAY_STROKE}
                  strokeWidth={2.2}
                  fill="none"
                  strokeLinecap="round"
                />

                {/* inner arc */}
                <path
                  d={[
                    `M ${i0.x} ${i0.y}`,
                    `A ${innerBase - 0.8} ${innerBase - 0.8} 0 ${largeArc} 1 ${i1.x} ${i1.y}`,
                  ].join(" ")}
                  stroke={TODAY_STROKE}
                  strokeWidth={2.2}
                  fill="none"
                  strokeLinecap="round"
                />

                {/* radial bounds */}
                <line
                  x1={i0.x}
                  y1={i0.y}
                  x2={o0.x}
                  y2={o0.y}
                  stroke={TODAY_STROKE}
                  strokeWidth={2}
                  strokeLinecap="round"
                />
                <line
                  x1={i1.x}
                  y1={i1.y}
                  x2={o1.x}
                  y2={o1.y}
                  stroke={TODAY_STROKE}
                  strokeWidth={2}
                  strokeLinecap="round"
                />
              </g>
            );
          })()}

          {/* Grid cells */}
          {categories.map((cat, ringIdx) => {
            const rOuter = gridOuter - ringIdx * ringThickness;
            const rInner = rOuter - ringThickness + ringGap;

            return days.map((day, dayIdx) => {
              const a0 = rotation + (labelDays + dayIdx) * step;
              const a1 = rotation + (labelDays + dayIdx + 1) * step;

              const key = `${cat.categoryId}|${day}`;
              const status = entryMap.get(key) ?? "EMPTY";

              const dPath = annularSectorPath(cx, cy, rInner, rOuter, a0, a1);

              // corners of the wedge quad
              const p0 = polar(cx, cy, rOuter, a0);
              const p1 = polar(cx, cy, rOuter, a1);
              const p3 = polar(cx, cy, rInner, a0);

              // glyph placement
              const midA = (a0 + a1) / 2;
              const midR = (rInner + rOuter) / 2;
              const mid = polar(cx, cy, midR, midA);

              const clipId = `half-clip-${roundId}-${cat.categoryId}-${dayIdx}`;

              return (
                <g key={key}>
                  {/* Base wedge (the only clickable element) */}
                  <path
                    d={dPath}
                    fill={baseCellFill(ringIdx, status)}
                    stroke="rgba(255,255,255,0.10)"
                    strokeWidth={1}
                    className="cursor-pointer transition-opacity hover:opacity-95"
                    onClick={() => onCellClick(roundId, cat.categoryId, day)}
                  >
                    <title>
                      {cat.displayName} • {day} • {status}
                    </title>
                  </path>

                  {/* HALF overlay */}
                  {status === "HALF" && (
                    <>
                      <defs>
                        <clipPath id={clipId}>
                          <polygon
                            points={[
                              `${p0.x},${p0.y}`,
                              `${p1.x},${p1.y}`,
                              `${p3.x},${p3.y}`,
                            ].join(" ")}
                          />
                        </clipPath>
                      </defs>

                      <path
                        d={dPath}
                        fill={GREEN_OVERLAY}
                        clipPath={`url(#${clipId})`}
                        pointerEvents="none"
                      />
                    </>
                  )}

                  {/* SICK/TREAT overlay */}
                  {(status === "SICK" || status === "TREAT") && (
                    <path d={dPath} fill={ORANGE_FILL} opacity={0.92} pointerEvents="none" />
                  )}

                  {/* Glyph */}
                  {status !== "EMPTY" && (
                    <text
                      x={mid.x}
                      y={mid.y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={12}
                      fill={glyphColor(status)}
                      style={{ fontWeight: 900, pointerEvents: "none" }}
                    >
                      {statusGlyph(status)}
                    </text>
                  )}
                </g>
              );
            });
          })}

          {/* Category label slice */}
          <g>
            {categories.map((cat, ringIdx) => {
              const rOuter = gridOuter - ringIdx * ringThickness;
              const rInner = rOuter - ringThickness + ringGap;
              const midR = (rInner + rOuter) / 2;
              const arcId = `label-arc-${roundId}-${cat.categoryId}`;

              return (
                <g key={`label-slice-${cat.categoryId}`}>
                  <path
                    d={annularSectorPath(
                      cx,
                      cy,
                      rInner,
                      rOuter,
                      labelSliceStart,
                      labelSliceEnd
                    )}
                    fill={rgba(ringRGB(ringIdx), 0.18)}
                    stroke={rgba(ringRGB(ringIdx), 0.45)}
                    strokeWidth={0.8}
                  />
                  <defs>
                    <path
                      id={arcId}
                      d={arcPath(cx, cy, midR, labelSliceStart + 0.01, labelSliceEnd - 0.01)}
                    />
                  </defs>
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={11}
                    fill="rgba(226,232,240,0.95)"
                    style={{ fontWeight: 800, letterSpacing: 0.2 }}
                  >
                    <textPath href={`#${arcId}`} startOffset="50%">
                      {cat.displayName}
                    </textPath>
                  </text>
                </g>
              );
            })}
          </g>

          {/* Center */}
          <circle cx={cx} cy={cy} r={innerBase - 6} fill="rgba(2,6,23,0.80)" />
          <circle
            cx={cx}
            cy={cy}
            r={innerBase - 6}
            fill="none"
            stroke="rgba(255,255,255,0.10)"
          />

          <text
            x={cx}
            y={cy - 12}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="rgba(226,232,240,0.95)"
            fontSize={14}
            style={{ fontWeight: 800, letterSpacing: 0.3 }}
          >
            {personName?.trim() ? personName : "Person"}
          </text>
          <text
            x={cx}
            y={cy + 14}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="rgba(255,255,255,0.95)"
            fontSize={18}
            style={{ fontWeight: 900, letterSpacing: 0.4 }}
          >
            {`Round ${roundNumber}`}
          </text>

        </svg>
      </div>
    </div>
  );
}
