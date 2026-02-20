"use client";

import React, { useEffect, useMemo, useState } from "react";

type Category = {
  categoryId: string;
  displayName: string;
  allowDaysOffPerWeek?: number;
  allowTreat?: boolean;
  allowSick?: boolean;
};

type WeightEntry = {
  weekIndex: number;
  weight: number;
  date?: string;
};

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
  weightEntries?: WeightEntry[];
  weightUnit?: "LBS" | "KG";
  onWeekWeightClick?: (weekIdx: number) => void;
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

function formatWeekdayShort(yyyyMMdd: string) {
  const d = parseLocalDay(yyyyMMdd);
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return labels[d.getDay()];
}

function formatDayLabel(yyyyMMdd: string) {
  return `${formatWeekdayShort(yyyyMMdd)} ${formatMMDD(yyyyMMdd)}`;
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

function statusButtonClass(status: string) {
  switch (status) {
    case "DONE":
      return "bg-emerald-500/70 text-white";
    case "HALF":
      return "bg-emerald-500/40 text-white";
    case "OFF":
      return "bg-rose-500/70 text-white";
    case "SICK":
    case "TREAT":
      return "bg-orange-400/70 text-white";
    default:
      return "bg-white/5 text-slate-200";
  }
}

function statusScore(status: string) {
  const st = (status ?? "").toUpperCase();
  if (st === "DONE") return 1;
  if (st === "HALF") return 0.5;
  return 0;
}

function requiredDaysForWeek(allowDaysOffPerWeek: number) {
  return Math.max(0, 7 - allowDaysOffPerWeek);
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

function formatWeight(value: number) {
  if (!Number.isFinite(value)) return "";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function unitLabel(unit?: "LBS" | "KG") {
  return unit === "KG" ? "kg" : "lbs";
}

export default function RoundWheel({
  roundId,
  roundNumber,
  personName,
  startDate,
  lengthWeeks,
  categories,
  entries,
  weightEntries,
  weightUnit,
  onWeekWeightClick,
  onCellClick,
  size = 640,
}: Props) {
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const [zoomTarget, setZoomTarget] = useState<{ weekIdx: number } | null>(null);
  const [hoverWeekIdx, setHoverWeekIdx] = useState<number | null>(null);
  const [pinnedWeekIdx, setPinnedWeekIdx] = useState<number | null>(null);
  const [hoverDay, setHoverDay] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(max-width: 640px)");
    const update = () => setIsSmallScreen(media.matches);
    update();
    if (media.addEventListener) {
      media.addEventListener("change", update);
      return () => media.removeEventListener("change", update);
    }
    media.addListener(update);
    return () => media.removeListener(update);
  }, []);


  const entryMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of entries) m.set(`${e.categoryId}|${e.date}`, e.status);
    return m;
  }, [entries]);

  const weightByWeekIdx = useMemo(() => {
    const m = new Map<number, WeightEntry>();
    if (!weightEntries) return m;
    for (const w of weightEntries) {
      m.set(w.weekIndex, w);
    }
    return m;
  }, [weightEntries]);

  // Local "today" key
  const todayKey = useMemo(() => formatDate(new Date()), []);
  const todayIdx = useMemo(() => {
    const idx = days.indexOf(todayKey);
    return idx >= 0 ? idx : -1;
  }, [days, todayKey]);

  const weekPercentByCategory = useMemo(() => {
    const m = new Map<string, number[]>();
    const weeks = Math.max(0, lengthWeeks);

    for (const cat of categories) {
      const allowDaysOff = cat.allowDaysOffPerWeek ?? 0;
      const required = requiredDaysForWeek(allowDaysOff);
      const perWeek: number[] = [];

      for (let w = 0; w < weeks; w += 1) {
        if (required <= 0) {
          perWeek.push(1);
          continue;
        }

        const startIdx = w * 7;
        const weekDays = days.slice(startIdx, startIdx + 7);
        let score = 0;
        for (const day of weekDays) {
          const status = entryMap.get(`${cat.categoryId}|${day}`) ?? "EMPTY";
          score += statusScore(status);
        }

        const pct = Math.min(score, required) / required;
        perWeek.push(Math.max(0, Math.min(1, pct)));
      }

      m.set(cat.categoryId, perWeek);
    }

    return m;
  }, [categories, days, entryMap, lengthWeeks]);

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
  const glyphFontSize = Math.max(7, Math.min(10, ringThickness * 0.38));

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
  const weekIconR = labelOuter - 12;

  // Today highlight style
  const TODAY_STROKE = "rgba(250,204,21,0.95)"; // amber/yellow
  const TODAY_GLOW = "rgba(250,204,21,0.25)";

  const activeZoomTarget =
    isSmallScreen && zoomTarget && zoomTarget.weekIdx < lengthWeeks ? zoomTarget : null;
  const activePinnedWeekIdx =
    pinnedWeekIdx !== null && pinnedWeekIdx < lengthWeeks ? pinnedWeekIdx : null;
  const activeHoverWeekIdx =
    hoverWeekIdx !== null && hoverWeekIdx < lengthWeeks ? hoverWeekIdx : null;

  const zoomWeekDays = activeZoomTarget
    ? days.slice(activeZoomTarget.weekIdx * 7, activeZoomTarget.weekIdx * 7 + 7)
    : [];
  const zoomWeekLabel = activeZoomTarget ? `Week ${activeZoomTarget.weekIdx + 1}` : "";
  const zoomWeekWeight = activeZoomTarget ? weightByWeekIdx.get(activeZoomTarget.weekIdx) : undefined;
  const tooltipWeekIdx = activePinnedWeekIdx ?? activeHoverWeekIdx;
  const tooltipWeight = tooltipWeekIdx !== null ? weightByWeekIdx.get(tooltipWeekIdx) : undefined;
  const activeDay = useMemo(() => {
    const day = hoverDay ?? selectedDay;
    return day && days.includes(day) ? day : null;
  }, [days, hoverDay, selectedDay]);

  function getWeekPercent(weekIdx: number, cat: Category) {
    const cached = weekPercentByCategory.get(cat.categoryId);
    if (cached && cached[weekIdx] !== undefined) {
      return cached[weekIdx];
    }

    const startIdx = weekIdx * 7;
    const weekDays = days.slice(startIdx, startIdx + 7);
    const allowDaysOff = cat.allowDaysOffPerWeek ?? 0;
    const required = requiredDaysForWeek(allowDaysOff);
    if (required <= 0) return 1;

    let score = 0;
    for (const day of weekDays) {
      const status = entryMap.get(`${cat.categoryId}|${day}`) ?? "EMPTY";
      score += statusScore(status);
    }

    return Math.max(0, Math.min(1, Math.min(score, required) / required));
  }

  const tooltipPos =
    tooltipWeekIdx !== null
      ? (() => {
          const midDay = labelDays + tooltipWeekIdx * 7 + 3.5;
          const angle = rotation + midDay * step;
          return polar(cx, cy, weekR, angle);
        })()
      : null;

  useEffect(() => {
    const handlePointerDown = () => {
      if (activePinnedWeekIdx !== null) setPinnedWeekIdx(null);
      if (activeHoverWeekIdx !== null) setHoverWeekIdx(null);
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [activePinnedWeekIdx, activeHoverWeekIdx]);

  return (
    <div className="w-full">
      <div className="relative mx-auto w-full max-w-[900px]">
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
            fill="rgba(17,17,17,0.10)"
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
            const startDay = labelDays + w * 7;
            const endDay = startDay + 7;
            const a0 = rotation + startDay * step;
            const a1 = rotation + endDay * step;
            const weight = weightByWeekIdx.get(w);
            const label = weight
              ? `Week ${w + 1} • ${formatWeight(weight.weight)} ${unitLabel(weightUnit)}`
              : `Week ${w + 1}`;
            const arcId = `week-label-arc-${roundId}-${w}`;
            const iconAngle = a0 + step * 0.8;
            const iconPos = polar(cx, cy, weekIconR, iconAngle);

            return (
              <g key={`week-label-${w}`}>
                <defs>
                  <path
                    id={arcId}
                    d={arcPath(cx, cy, weekR, a0 + 0.01, a1 - 0.01)}
                  />
                </defs>
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={10.5}
                  fill="rgba(148,163,184,0.95)"
                  style={{ fontWeight: 700, letterSpacing: 0.2 }}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoverWeekIdx(w)}
                  onMouseLeave={() => {
                    if (activePinnedWeekIdx === null) setHoverWeekIdx(null);
                  }}
                onClick={(e) => {
                  e.stopPropagation();
                  setPinnedWeekIdx((prev) => (prev === w ? null : w));
                  setHoverWeekIdx(w);
                }}
              >
                <textPath href={`#${arcId}`} startOffset="50%">
                  {label}
                </textPath>
              </text>
                {onWeekWeightClick && (
                  <g
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      onWeekWeightClick(w);
                    }}
                  >
                    <title>Set weight</title>
                    {/* Larger invisible hit target for easier clicking */}
                    <circle
                      cx={iconPos.x}
                      cy={iconPos.y}
                      r={14}
                      fill="transparent"
                      stroke="none"
                    />
                    <g
                      transform={`translate(${iconPos.x - 7}, ${iconPos.y - 7})`}
                      fill="none"
                      stroke="rgba(226,232,240,0.9)"
                      strokeWidth={1.4}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      pointerEvents="none"
                    >
                      {/* Simple scale icon */}
                      <rect x="1.5" y="2.5" width="11" height="9" rx="2.4" />
                      <circle cx="7" cy="5.5" r="1.4" />
                      <path d="M7 5.5 L9 3.8" />
                    </g>
                  </g>
                )}
              </g>
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

          {/* Progress dashes (per category, per week) */}
          {categories.map((cat, ringIdx) => {
            const perWeek = weekPercentByCategory.get(cat.categoryId) ?? [];
            return Array.from({ length: lengthWeeks }, (_, w) => {
              const pct = Math.max(0, Math.min(1, perWeek[w] ?? 0));
              if (pct <= 0) return null;

              const weekStartIdx = w * 7;
              const a0 = rotation + (labelDays + weekStartIdx) * step;
              const weekArc = step * 7;
              const a1 = a0 + weekArc * pct;
              const rOuter = gridOuter - ringIdx * ringThickness;
              const rDash = rOuter - 1.2;

              return (
                <path
                  key={`week-dash-${cat.categoryId}-${w}`}
                  d={arcPath(cx, cy, rDash, a0, a1)}
                  stroke={rgba(ringRGB(ringIdx), 0.55)}
                  strokeWidth={1.6}
                  fill="none"
                  strokeLinecap="round"
                  pointerEvents="none"
                />
              );
            });
          })}

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
                    onMouseEnter={() => setHoverDay(day)}
                    onMouseLeave={() => setHoverDay(null)}
                    onClick={() => {
                      if (isSmallScreen) {
                        setZoomTarget({ weekIdx: Math.floor(dayIdx / 7) });
                        return;
                      }
                      setSelectedDay(day);
                      onCellClick(roundId, cat.categoryId, day);
                    }}
                  >
                    <title>
                      {cat.displayName} • {formatWeekdayShort(day)} {day} • {status}
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
                      fontSize={glyphFontSize}
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
          <circle cx={cx} cy={cy} r={innerBase - 6} fill="rgba(17,17,17,0.90)" />
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
          {activeDay && (
            <text
              x={cx}
              y={cy - 34}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="rgba(148,163,184,0.95)"
              fontSize={10}
              style={{ fontWeight: 700, letterSpacing: 0.2 }}
            >
              {formatDayLabel(activeDay)}
            </text>
          )}

        </svg>
        {tooltipPos && tooltipWeekIdx !== null && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full"
            style={{
              left: `${(tooltipPos.x / view) * 100}%`,
              top: `${(tooltipPos.y / view) * 100}%`,
            }}
          >
            <div className="min-w-[190px] rounded-xl border border-white/10 bg-[#111111]/95 px-3 py-2 shadow-xl backdrop-blur">
              <div className="text-[10px] uppercase tracking-wide text-slate-400">
                Week {tooltipWeekIdx + 1}
              </div>
              {tooltipWeight && (
                <div className="mt-2 flex items-center justify-between text-xs text-slate-200">
                  <span>Weight</span>
                  <span className="tabular-nums">
                    {tooltipWeight.weight.toFixed(1)} {unitLabel(weightUnit)}
                  </span>
                </div>
              )}
              <div className="mt-2 space-y-2">
                {categories.map((cat, ringIdx) => {
                  const pct = Math.round(getWeekPercent(tooltipWeekIdx, cat) * 100);
                  return (
                    <div key={`week-tip-${cat.categoryId}`} className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: rgba(ringRGB(ringIdx), 0.85) }}
                      />
                      <span className="flex-1 text-xs text-slate-200">{cat.displayName}</span>
                      <div className="h-1.5 w-16 rounded-full bg-white/10">
                        <div
                          className="h-1.5 rounded-full"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: rgba(ringRGB(ringIdx), 0.85),
                          }}
                        />
                      </div>
                      <span className="w-8 text-right text-[10px] text-slate-300">
                        {pct}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {isSmallScreen && activeZoomTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => setZoomTarget(null)}
          />
          <div className="relative w-full max-w-md max-h-[85vh] overflow-y-auto rounded-3xl border border-white/10 bg-[#111111]/95 p-5 shadow-2xl backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  {zoomWeekLabel}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-300">
                  <span>
                    Weight:{" "}
                    {zoomWeekWeight
                      ? `${zoomWeekWeight.weight.toFixed(1)} ${unitLabel(weightUnit)}`
                      : "—"}
                  </span>
                  {onWeekWeightClick && (
                    <button
                      className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold text-slate-200"
                      onClick={() => onWeekWeightClick(activeZoomTarget.weekIdx)}
                    >
                      {zoomWeekWeight ? "Edit weight" : "Add weight"}
                    </button>
                  )}
                </div>
                {zoomWeekDays.length > 0 && (
                  <p className="mt-1 text-xs text-slate-400">
                    {formatMMDD(zoomWeekDays[0])} -{" "}
                    {formatMMDD(zoomWeekDays[zoomWeekDays.length - 1])}
                  </p>
                )}
              </div>
              <button
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200"
                onClick={() => setZoomTarget(null)}
              >
                Close
              </button>
            </div>

            <p className="mt-3 text-sm text-slate-300">
              Tap a day to cycle its status.
            </p>

            <div className="mt-4 space-y-4">
              {categories.map((cat, ringIdx) => (
                <div key={`zoom-cat-${cat.categoryId}`} className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: rgba(ringRGB(ringIdx), 0.85) }}
                    />
                    <span>{cat.displayName}</span>
                  </div>
                  <div className="grid grid-cols-7 gap-2">
                    {zoomWeekDays.map((day) => {
                      const status = entryMap.get(`${cat.categoryId}|${day}`) ?? "EMPTY";
                      const glyph = statusGlyph(status) || "-";
                      return (
                        <button
                          key={`zoom-${cat.categoryId}-${day}`}
                          className={`flex flex-col items-center justify-center gap-1 rounded-xl border border-white/10 px-2 py-2 text-[10px] font-semibold ${statusButtonClass(
                            status
                          )}`}
                          onClick={() => onCellClick(roundId, cat.categoryId, day)}
                        >
                          <span className="uppercase text-white/80">
                            {formatWeekdayShort(day)}
                          </span>
                          <span className="text-base font-black">{glyph}</span>
                          <span className="text-white/70">{formatMMDD(day)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
