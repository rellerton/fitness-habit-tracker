"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import RoundWheel from "@/components/RoundWheel";
import StatusLegend from "@/components/StatusLegend";
import { apiUrl, joinIngressPath, useIngressPrefix } from "@/lib/ingress";


type Person = { id: string; name: string };
type TrackerTypeOption = { id: string; name: string; active: boolean };
type Tracker = {
  id: string;
  name: string;
  active: boolean;
  trackerTypeId: string;
  trackerType: { id: string; name: string; active: boolean };
  roundsCount?: number;
  latestRoundCreatedAt?: string | null;
};

type Category = {
  categoryId: string;
  displayName: string;
  allowDaysOffPerWeek?: number;
  allowTreat?: boolean;
  allowSick?: boolean;
};
type WeightUnit = "LBS" | "KG";

type RoundPayload = {
  id: string;
  startDate: string;
  lengthWeeks: number;
  goalWeight: number | null;
  roundCategories: Category[];
  entries: { categoryId: string; date: string; status: string }[];
  weightEntries: { weekIndex: number; weight: number; date: string }[];
};

type LatestRoundResponse = {
  round: RoundPayload | null;
  roundNumber: number;
  tracker?: {
    id: string;
    name: string;
    trackerTypeId: string;
    trackerTypeName: string;
  } | null;
};

type RoundHistoryItem = {
  id: string;
  startDate: string;
  lengthWeeks: number;
  goalWeight: number | null;
  active: boolean;
  createdAt: string;
  roundNumber: number;
  trackerId?: string;
  tracker?: {
    id: string;
    name: string;
    trackerTypeId: string;
    trackerTypeName: string;
  };
  roundCategories: Category[];
  entries: { categoryId: string; date: string; status: string }[];
  weightEntries: { weekIndex: number; weight: number; date: string }[];
};

function yyyyMmDd(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseLocalDay(s: string) {
  const ymd = String(s).slice(0, 10);
  const d = new Date(`${ymd}T00:00:00`);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid date string: ${s}`);
  }
  return d;
}



function statusScore(status: string) {
  const st = (status ?? "").toUpperCase();
  if (st === "DONE") return 1;
  if (st === "HALF") return 0.5;
  return 0;
}

const MS_DAY = 24 * 60 * 60 * 1000;

function completedWeeksForRound(startDate: string, lengthWeeks: number) {
  const start = parseLocalDay(startDate);
  const today = parseLocalDay(yyyyMmDd(new Date()));
  const diffDays = Math.floor((today.getTime() - start.getTime()) / MS_DAY);
  if (diffDays <= 0) return 0;
  return Math.min(lengthWeeks, Math.floor(diffDays / 7));
}

function buildEntryMap(entries: { categoryId: string; date: string; status: string }[]) {
  const map = new Map<string, Map<string, string>>();
  for (const entry of entries) {
    const catMap = map.get(entry.categoryId) ?? new Map<string, string>();
    catMap.set(entry.date, entry.status);
    map.set(entry.categoryId, catMap);
  }
  return map;
}

function calcCategoryPercentByWeeks({
  entryMap,
  startDate,
  weeksCount,
  categoryId,
  allowDaysOffPerWeek,
}: {
  entryMap: Map<string, Map<string, string>>;
  startDate: string;
  weeksCount: number;
  categoryId: string;
  allowDaysOffPerWeek: number;
}) {
  if (weeksCount <= 0) return null;
  if (allowDaysOffPerWeek >= 7) return 100;
  const required = Math.max(0, 7 - allowDaysOffPerWeek);
  if (required <= 0) return 100;

  const catMap = entryMap.get(categoryId) ?? new Map<string, string>();
  let totalPct = 0;

  for (let w = 0; w < weeksCount; w += 1) {
    let score = 0;
    for (let d = 0; d < 7; d += 1) {
      const dateStr = yyyyMmDd(addDays(startDate, w * 7 + d));
      const status = catMap.get(dateStr) ?? "EMPTY";
      score += statusScore(status);
    }
    const pct = Math.min(score, required) / required;
    totalPct += Math.max(0, Math.min(1, pct));
  }

  return (totalPct / weeksCount) * 100;
}

function calcTotalPercentByWeeks({
  entryMap,
  startDate,
  weeksCount,
  categories,
}: {
  entryMap: Map<string, Map<string, string>>;
  startDate: string;
  weeksCount: number;
  categories: { categoryId: string; allowDaysOffPerWeek?: number }[];
}) {
  if (weeksCount <= 0) return null;

  let totalPct = 0;

  for (let w = 0; w < weeksCount; w += 1) {
    let totalScore = 0;
    let totalRequired = 0;
    for (const c of categories) {
      const required = Math.max(0, 7 - (c.allowDaysOffPerWeek ?? 0));
      if (required <= 0) continue;
      totalRequired += required;
      let score = 0;
      const catMap = entryMap.get(c.categoryId) ?? new Map<string, string>();
      for (let d = 0; d < 7; d += 1) {
        const dateStr = yyyyMmDd(addDays(startDate, w * 7 + d));
        const status = catMap.get(dateStr) ?? "EMPTY";
        score += statusScore(status);
      }
      totalScore += Math.min(score, required);
    }

    const weekPct = totalRequired > 0 ? totalScore / totalRequired : 1;
    totalPct += Math.max(0, Math.min(1, weekPct));
  }

  return (totalPct / weeksCount) * 100;
}

function calcCategoryPercent(
  round: Pick<RoundHistoryItem, "startDate" | "lengthWeeks" | "entries">,
  categoryId: string,
  allowDaysOffPerWeek: number
) {
  const entryMap = buildEntryMap(round.entries);
  const pct = calcCategoryPercentByWeeks({
    entryMap,
    startDate: round.startDate,
    weeksCount: round.lengthWeeks,
    categoryId,
    allowDaysOffPerWeek,
  });
  return pct ?? 0;
}

function addDays(isoStart: string, daysToAdd: number) {
  const d = parseLocalDay(isoStart);
  d.setDate(d.getDate() + daysToAdd);
  return d;
}

function formatShort(d: Date) {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(2);
  return `${mm}/${dd}/${yy}`;
}

function weekStartDayLabel(startDate: string) {
  const d = parseLocalDay(startDate);
  const labels = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return labels[d.getDay()];
}

function CompactPct({
  pct,
  tone,
  barWidthClass = "w-16",
  gapClass = "gap-1.5",
}: {
  pct: number | null;
  tone: "total" | "cat";
  barWidthClass?: string;
  gapClass?: string;
}) {
  const clamped = pct === null ? 0 : Math.max(0, Math.min(100, pct));
  return (
    <div className={`inline-flex items-center whitespace-nowrap ${gapClass}`}>
      <div className={`h-1.5 ${barWidthClass} rounded-full bg-white/10`}>
        <div
          className={`h-1.5 rounded-full ${tone === "total" ? "bg-emerald-400/60" : "bg-sky-400/60"}`}
          style={{ width: `${clamped.toFixed(0)}%` }}
        />
      </div>
      <span className="w-8 text-right text-xs tabular-nums text-slate-300">
        {pct === null ? "—" : `${clamped.toFixed(0)}%`}
      </span>
    </div>
  );
}

function RoundSummaryPanel({
  round,
  completedWeeks,
  title,
}: {
  round: Pick<RoundHistoryItem, "startDate" | "lengthWeeks" | "entries" | "roundCategories">;
  completedWeeks: number;
  title: string;
}) {
  const entryMap = buildEntryMap(round.entries);
  const perCategory = round.roundCategories.map((c) => {
    const pct = calcCategoryPercentByWeeks({
      entryMap,
      startDate: round.startDate,
      weeksCount: completedWeeks,
      categoryId: c.categoryId,
      allowDaysOffPerWeek: c.allowDaysOffPerWeek ?? 0,
    });
    return { ...c, pct };
  });

  const totalPct = calcTotalPercentByWeeks({
    entryMap,
    startDate: round.startDate,
    weeksCount: completedWeeks,
    categories: round.roundCategories,
  });

  return (
    <section className="mt-4 w-full max-w-[900px] mx-auto">
      <div className="flex items-center justify-between gap-4 px-1">
        <div>
          <div className="text-sm font-semibold text-slate-200">{title}</div>
          <div className="text-xs text-slate-400">
            {completedWeeks === 0
              ? "No completed weeks yet."
              : `Through week ${completedWeeks}`}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Total</span>
          <CompactPct pct={totalPct} tone="total" barWidthClass="w-28" />
        </div>
      </div>

      <div className="mt-2 grid grid-cols-1 gap-y-0.5 gap-x-4 sm:grid-cols-2 lg:grid-cols-5">
        {perCategory.map((c) => {
          const pct = c.pct === null ? null : Math.max(0, Math.min(100, c.pct));
          return (
            <div
              key={c.categoryId}
              className="grid grid-cols-[112px,1fr,36px] items-center gap-2 px-1 py-0"
            >
              <div className="truncate text-sm font-semibold text-slate-200">
                {c.displayName}:
              </div>
              <div className="h-1.5 w-full rounded-full bg-white/10">
                <div
                  className="h-1.5 rounded-full bg-sky-400/60"
                  style={{ width: `${pct === null ? 0 : pct.toFixed(0)}%` }}
                />
              </div>
              <div className="text-right text-xs tabular-nums text-slate-300">
                {pct === null ? "—" : `${pct.toFixed(0)}%`}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function WeightChart({
  lengthWeeks,
  weightEntries,
  title = "Weight by week",
  goalWeight,
  weightUnit,
}: {
  lengthWeeks: number;
  weightEntries: { weekIndex: number; weight: number }[];
  title?: string;
  goalWeight?: number | null;
  weightUnit: WeightUnit;
}) {
  if (!weightEntries || weightEntries.length === 0) return null;

  const byWeek = new Map<number, number>();
  for (const w of weightEntries) {
    if (Number.isFinite(w.weight)) byWeek.set(w.weekIndex, w.weight);
  }
  if (byWeek.size === 0) return null;

  const points = Array.from({ length: lengthWeeks }, (_, idx) => ({
    week: idx,
    weight: byWeek.get(idx),
  })).filter((p) => p.weight !== undefined) as { week: number; weight: number }[];

  if (points.length === 0) return null;

  const values = points.map((p) => p.weight);
  if (goalWeight !== undefined && goalWeight !== null && Number.isFinite(goalWeight)) {
    values.push(goalWeight);
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max(1, (max - min) * 0.15);
  const yMin = min - pad;
  const yMax = max + pad;

  const width = 760;
  const height = 110;
  const padding = 16;
  const usableW = width - padding * 2;
  const usableH = height - padding * 2;

  const xForWeek = (week: number) =>
    padding + (lengthWeeks <= 1 ? 0 : (week / (lengthWeeks - 1)) * usableW);
  const yForWeight = (weight: number) =>
    padding + (1 - (weight - yMin) / (yMax - yMin || 1)) * usableH;

  const pathD = points
    .map((p, idx) => {
      const x = xForWeek(p.week);
      const y = yForWeight(p.weight);
      return `${idx === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  const latest = points[points.length - 1];
  const earliest = points[0];
  const goalY =
    goalWeight !== undefined && goalWeight !== null && Number.isFinite(goalWeight)
      ? yForWeight(goalWeight)
      : null;
  const fillPath = `${pathD} L ${xForWeek(latest.week)} ${height - padding} L ${xForWeek(earliest.week)} ${height - padding} Z`;

  const unitLabel = weightUnit === "KG" ? "kg" : "lbs";

  return (
    <div className="mt-5 w-full max-w-[900px] mx-auto">
      <div className="mb-3 h-px w-full bg-white/10" />
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
        <div className="text-xs text-slate-400">
          {points.length}/{lengthWeeks} weeks
        </div>
      </div>
      <div className="mt-2">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-[110px] w-full"
          role="img"
          aria-label="Weight by week chart"
        >
          <defs>
            <linearGradient id="weightLine" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(56,189,248,0.9)" />
              <stop offset="100%" stopColor="rgba(34,197,94,0.85)" />
            </linearGradient>
            <linearGradient id="weightFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(56,189,248,0.2)" />
              <stop offset="100%" stopColor="rgba(17,17,17,0.0)" />
            </linearGradient>
          </defs>

          <rect
            x={padding}
            y={padding}
            width={usableW}
            height={usableH}
            rx={12}
            fill="rgba(255,255,255,0.03)"
            stroke="rgba(255,255,255,0.08)"
          />
          <path
            d={`M ${padding} ${height - padding} L ${width - padding} ${height - padding}`}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={1}
          />
          <path d={fillPath} fill="url(#weightFill)" />
          {goalY !== null && (
            <g>
              <line
                x1={padding}
                y1={goalY}
                x2={width - padding}
                y2={goalY}
                stroke="rgba(251,191,36,0.65)"
                strokeWidth={1.5}
                strokeDasharray="4 4"
              />
              <text
                x={width - padding}
                y={Math.max(padding + 10, goalY - 6)}
                textAnchor="end"
                fontSize={10}
                fill="rgba(251,191,36,0.85)"
              >
                Goal {goalWeight!.toFixed(1)} {unitLabel}
              </text>
            </g>
          )}
          <path
            d={pathD}
            fill="none"
            stroke="url(#weightLine)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {points.map((p) => {
            const x = xForWeek(p.week);
            const y = yForWeight(p.weight);
            return (
              <circle key={`pt-${p.week}`} cx={x} cy={y} r={3} fill="rgba(226,232,240,0.9)" />
            );
          })}
          <text
            x={padding}
            y={padding + 2}
            textAnchor="start"
            fontSize={10}
            fill="rgba(148,163,184,0.8)"
          >
          {earliest.weight.toFixed(1)} {unitLabel}
          </text>
          <text
            x={width - padding}
            y={padding + 2}
            textAnchor="end"
            fontSize={10}
            fill="rgba(148,163,184,0.8)"
          >
          {latest.weight.toFixed(1)} {unitLabel}
          </text>
        </svg>
      </div>
    </div>
  );
}

function calcTotalPercent(
  r: Pick<RoundHistoryItem, "startDate" | "lengthWeeks" | "entries" | "roundCategories">
) {
  if (r.roundCategories.length === 0) return 0;
  const entryMap = buildEntryMap(r.entries);
  const pct = calcTotalPercentByWeeks({
    entryMap,
    startDate: r.startDate,
    weeksCount: r.lengthWeeks,
    categories: r.roundCategories,
  });
  return pct ?? 0;
}

function shouldHideControls(v: string | null) {
  if (!v) return false;
  const s = v.trim().toLowerCase();
  return s === "0" || s === "false" || s === "off" || s === "hide" || s === "no";
}

function formatTrackerLabel(tracker: Tracker | null) {
  if (!tracker) return "No tracker selected";
  if (tracker.name.trim().toLowerCase() === tracker.trackerType.name.trim().toLowerCase()) {
    return tracker.name;
  }
  return `${tracker.name} (${tracker.trackerType.name})`;
}

export default function PersonPage() {
  const routeParams = useParams<{ personId: string }>();
  const personId = routeParams.personId;
  const ingressPrefix = useIngressPrefix();

  const [person, setPerson] = useState<Person | null>(null);
  const [weightUnit, setWeightUnit] = useState<WeightUnit>("LBS");
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [trackersLoaded, setTrackersLoaded] = useState(false);
  const [trackerTypes, setTrackerTypes] = useState<TrackerTypeOption[]>([]);
  const [selectedTrackerId, setSelectedTrackerId] = useState<string>("");
  const [initialRoundResolved, setInitialRoundResolved] = useState(false);
  const [newTrackerTypeId, setNewTrackerTypeId] = useState<string>("");
  const [trackerBusy, setTrackerBusy] = useState(false);
  const [showAddTrackerControls, setShowAddTrackerControls] = useState(false);

  const [round, setRound] = useState<RoundPayload | null>(null);
  const [roundNumber, setRoundNumber] = useState<number>(0);

  const [history, setHistory] = useState<RoundHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [weightModalOpen, setWeightModalOpen] = useState(false);
  const [weightModalWeekIdx, setWeightModalWeekIdx] = useState<number | null>(null);
  const [weightModalDateInput, setWeightModalDateInput] = useState<string>("");
  const [weightModalValueInput, setWeightModalValueInput] = useState<string>("");
  const [weightSaving, setWeightSaving] = useState(false);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    roundNumber: number;
    trackerName: string;
  } | null>(null);

  // modal
  const [openRound, setOpenRound] = useState<RoundHistoryItem | null>(null);

  // Hide controls query parameter
  const searchParams = useSearchParams();
  const hideControls = useMemo(
    () => shouldHideControls(searchParams.get("controls")),
    [searchParams]
  );
  const selectedTracker = useMemo(
    () => trackers.find((t) => t.id === selectedTrackerId) ?? null,
    [trackers, selectedTrackerId]
  );
  const hasMultipleTrackers = trackers.length > 1;
  const showTrackerSwitcher = !hideControls && hasMultipleTrackers;
  const showAddTrackerPanel =
    !hideControls && (showAddTrackerControls || trackers.length === 0);

  async function loadPerson() {
    if (!personId) return;

    const res = await fetch(apiUrl(`people/${personId}`));
    const data = await res.json().catch(() => null);

    if (res.ok && data?.id) {
      setPerson(data);
      return;
    }

    console.error("Failed to load person:", data);
    setPerson(null);
  }

  async function loadTrackers() {
    if (!personId) return;
    setTrackersLoaded(false);

    const res = await fetch(apiUrl(`trackers?personId=${encodeURIComponent(personId)}`));
    const data = (await res.json().catch(() => null)) as Tracker[] | null;

    if (!res.ok || !Array.isArray(data)) {
      console.error("Failed to load trackers:", data);
      setTrackers([]);
      setSelectedTrackerId("");
      setTrackersLoaded(true);
      return;
    }

    setTrackers(data);

    if (data.length === 0) {
      setSelectedTrackerId("");
      setTrackersLoaded(true);
      return;
    }

    setSelectedTrackerId((prev) => {
      if (prev && data.some((t) => t.id === prev)) return prev;
      const requested = searchParams.get("trackerId");
      if (requested && data.some((t) => t.id === requested)) return requested;
      const withRounds = data
        .filter((t) => (t.roundsCount ?? 0) > 0)
        .sort((a, b) => {
          const aTime = a.latestRoundCreatedAt ? Date.parse(a.latestRoundCreatedAt) : 0;
          const bTime = b.latestRoundCreatedAt ? Date.parse(b.latestRoundCreatedAt) : 0;
          return bTime - aTime;
        });
      if (withRounds.length > 0) return withRounds[0].id;
      const defaultTracker = data.find((t) => t.name.trim().toLowerCase() === "default");
      if (defaultTracker) return defaultTracker.id;
      return data[0].id;
    });
    setTrackersLoaded(true);
  }

  async function loadTrackerTypes() {
    const res = await fetch(apiUrl("tracker-types"));
    const data = (await res.json().catch(() => null)) as TrackerTypeOption[] | null;

    if (!res.ok || !Array.isArray(data)) {
      console.error("Failed to load tracker types:", data);
      setTrackerTypes([]);
      setNewTrackerTypeId("");
      return;
    }

    setTrackerTypes(data);
    setNewTrackerTypeId((prev) => {
      if (prev && data.some((t) => t.id === prev)) return prev;
      return data[0]?.id ?? "";
    });
  }

  async function loadLatestRound() {
    if (!personId || !selectedTrackerId) {
      setRound(null);
      setRoundNumber(0);
      return;
    }

    const res = await fetch(
      apiUrl(`people/${personId}/latest-round?trackerId=${encodeURIComponent(selectedTrackerId)}`)
    );
    const data = (await res.json().catch(() => null)) as LatestRoundResponse | null;

    if (!res.ok) {
      console.error("Failed to load latest round:", data);
      setRound(null);
      setRoundNumber(0);
      return;
    }

    setRound(data?.round ?? null);
    setRoundNumber(typeof data?.roundNumber === "number" ? data.roundNumber : 0);
  }

  async function loadRoundHistory() {
    if (!personId || !selectedTrackerId) {
      setHistory([]);
      return;
    }

    setHistoryLoading(true);
    const res = await fetch(
      apiUrl(`people/${personId}/rounds?trackerId=${encodeURIComponent(selectedTrackerId)}`)
    );
    const data = (await res.json().catch(() => null)) as RoundHistoryItem[] | null;

    if (!res.ok || !Array.isArray(data)) {
      console.error("Failed to load round history:", data);
      setHistory([]);
      setHistoryLoading(false);
      return;
    }

    setHistory(data);
    setHistoryLoading(false);
  }

  // New round confirmation modal state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [startDateInput, setStartDateInput] = useState<string>(() => yyyyMmDd(new Date()));
  const [roundLengthWeeks, setRoundLengthWeeks] = useState<number>(8);
  const [goalWeightInput, setGoalWeightInput] = useState<string>("");
  const [editStartOpen, setEditStartOpen] = useState(false);
  const [editStartDateInput, setEditStartDateInput] = useState<string>("");
  const [editGoalWeightInput, setEditGoalWeightInput] = useState<string>("");

  function openNewRoundPrompt() {
    setStartDateInput(yyyyMmDd(new Date()));
    setRoundLengthWeeks(8);
    setGoalWeightInput("");
    setConfirmOpen(true);
  }

  async function loadSettings() {
    const res = await fetch(apiUrl("settings"));
    const data = await res.json().catch(() => null);
    if (res.ok && (data?.weightUnit === "LBS" || data?.weightUnit === "KG")) {
      setWeightUnit(data.weightUnit);
      return;
    }
    console.error("Failed to load settings:", data);
  }

  async function createTracker() {
    if (!personId || !newTrackerTypeId) return;

    setTrackerBusy(true);
    try {
      const res = await fetch(apiUrl("trackers"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personId,
          trackerTypeId: newTrackerTypeId,
        }),
      });
      const created = (await res.json().catch(() => null)) as Tracker | { error?: string } | null;
      if (!res.ok || !created || !("id" in created)) {
        alert(`Failed to create tracker: ${(created as { error?: string } | null)?.error ?? "Unknown error"}`);
        return;
      }

      await loadTrackers();
      setSelectedTrackerId(created.id);
      setShowAddTrackerControls(false);
    } finally {
      setTrackerBusy(false);
    }
  }

  function openEditStartPrompt() {
    if (!round) return;
    setEditStartDateInput(round.startDate);
    setEditGoalWeightInput(
      round.goalWeight !== null && round.goalWeight !== undefined
        ? round.goalWeight.toFixed(1)
        : ""
    );
    setEditStartOpen(true);
  }

  async function confirmStartRound() {
    if (!personId || !selectedTrackerId) return;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDateInput)) {
      alert("Please pick a valid start date.");
      return;
    }

    if (roundLengthWeeks !== 4 && roundLengthWeeks !== 8) {
      alert("Round length must be 4 or 8 weeks.");
      return;
    }

    let goalWeight: number | undefined;
    if (goalWeightInput.trim() !== "") {
      const parsed = Number(goalWeightInput);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        alert("Goal weight must be a number > 0.");
        return;
      }
      goalWeight = parsed;
    }

    setLoading(true);

    const res = await fetch(apiUrl("rounds/start"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        personId,
        trackerId: selectedTrackerId,
        startDate: startDateInput,
        lengthWeeks: roundLengthWeeks,
        ...(goalWeight !== undefined ? { goalWeight } : {}),
      }),
    });

    const created = await res.json().catch(() => null);

    if (!res.ok || !created?.id) {
      console.error("Start round failed:", created);
      alert(`Start round failed: ${created?.error ?? "Unknown error"}`);
      setLoading(false);
      return;
    }

    setConfirmOpen(false);
    await Promise.all([loadLatestRound(), loadRoundHistory()]);
    setLoading(false);
  }

  async function confirmEditStartDate() {
    if (!round) return;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(editStartDateInput)) {
      alert("Please pick a valid start date.");
      return;
    }

    let goalWeight: number | null | undefined;
    if (editGoalWeightInput.trim() !== "") {
      const parsed = Number(editGoalWeightInput);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        alert("Goal weight must be a number > 0.");
        return;
      }
      goalWeight = parsed;
    } else {
      goalWeight = null;
    }

    setLoading(true);

    const res = await fetch(apiUrl(`rounds/${round.id}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startDate: editStartDateInput,
        goalWeight,
      }),
    });

    const updated = await res.json().catch(() => null);

    if (!res.ok) {
      console.error("Update start date failed:", updated);
      alert(`Update failed: ${updated?.error ?? "Unknown error"}`);
      setLoading(false);
      return;
    }

    setEditStartOpen(false);
    await Promise.all([loadLatestRound(), loadRoundHistory()]);
    setLoading(false);
  }

  useEffect(() => {
    setTrackers([]);
    setSelectedTrackerId("");
    setRound(null);
    setRoundNumber(0);
    setHistory([]);
    setTrackersLoaded(false);
    setInitialRoundResolved(false);
    loadPerson();
    loadTrackers();
    loadTrackerTypes();
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personId]);

  useEffect(() => {
    if (!trackersLoaded) return;
    if (!selectedTrackerId && trackers.length > 0) return;

    let cancelled = false;
    (async () => {
      await Promise.all([loadLatestRound(), loadRoundHistory()]);
      if (!cancelled) setInitialRoundResolved(true);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personId, selectedTrackerId, trackers.length, trackersLoaded]);

  async function cycle(roundId: string, categoryId: string, day: string) {
    const res = await fetch(apiUrl("entries"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roundId, categoryId, date: day, mode: "cycle" }),
    });

    const updated = await res.json().catch(() => null);

    if (!res.ok) {
      console.error("Entry update failed:", updated);
      alert(`Entry update failed: ${updated?.error ?? "Unknown error"}`);
      return;
    }

    setRound((prev) => {
      if (!prev) return prev;

      const nextEntries = prev.entries.filter(
        (e) => !(e.categoryId === categoryId && e.date === day)
      );

      nextEntries.push({
        categoryId,
        date: day,
        status: updated.status,
      });

      return { ...prev, entries: nextEntries };
    });

    // optional: keep history in sync if you want (not required since history excludes active)
  }

  async function saveWeight() {
    if (!round || weightModalWeekIdx === null) return;

    const weight = Number(weightModalValueInput);
    if (!Number.isFinite(weight) || weight <= 0) {
      alert("Enter a valid weight greater than 0.");
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(weightModalDateInput)) {
      alert("Please pick a valid date.");
      return;
    }

    const weekIdx = weightModalWeekIdx;
    const weekStart = addDays(round.startDate, weekIdx * 7);
    const weekEnd = addDays(round.startDate, weekIdx * 7 + 6);
    const picked = parseLocalDay(weightModalDateInput);
    if (picked < weekStart || picked > weekEnd) {
      alert("Pick a date within this week.");
      return;
    }

    setWeightSaving(true);
    try {
      const res = await fetch(apiUrl("weights"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roundId: round.id,
          date: weightModalDateInput,
          weight,
        }),
      });

      const updated = await res.json().catch(() => null);
      if (!res.ok) {
        console.error("Weight update failed:", updated);
        alert(`Weight update failed: ${updated?.error ?? "Unknown error"}`);
        return;
      }

      setRound((prev) => {
        if (!prev) return prev;
        const nextEntries = (prev.weightEntries ?? []).filter(
          (w) => w.weekIndex !== updated.weekIndex
        );
        nextEntries.push(updated);
        return { ...prev, weightEntries: nextEntries };
      });
      setWeightModalOpen(false);
    } finally {
      setWeightSaving(false);
    }
  }

  function openDeletePrompt(id: string, roundNumber: number, trackerName: string) {
    setDeleteTarget({ id, roundNumber, trackerName });
    setDeleteConfirmOpen(true);
  }

  async function confirmDeleteRound() {
    if (!personId || !deleteTarget) return;

    setLoading(true);

    const res = await fetch(apiUrl(`rounds/${deleteTarget.id}`), { method: "DELETE" });
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      console.error("Delete round failed:", data);
      alert(`Delete failed: ${data?.error ?? "Unknown error"}`);
      setLoading(false);
      return;
    }

    // close modal + clear target
    setDeleteConfirmOpen(false);
    setDeleteTarget(null);

    // if it was open in the round-view modal, close it
    setOpenRound((prev) => (prev?.id === deleteTarget.id ? null : prev));

    await Promise.all([loadRoundHistory(), loadLatestRound()]);
    setLoading(false);
  }

  const inactiveRounds = useMemo(() => {
    if (!round) return history.filter((r) => !r.active);
    return history.filter((r) => r.id !== round.id); // exclude current even if active flag is weird
  }, [history, round]);

  const weightWeekRange = useMemo(() => {
    if (!round || weightModalWeekIdx === null) return null;
    const start = addDays(round.startDate, weightModalWeekIdx * 7);
    const end = addDays(round.startDate, weightModalWeekIdx * 7 + 6);
    return {
      start,
      end,
      label: `${formatShort(start)} - ${formatShort(end)}`,
    };
  }, [round, weightModalWeekIdx]);

  function openWeightModal(weekIdx: number) {
    if (!round) return;
    const existing = round.weightEntries?.find((w) => w.weekIndex === weekIdx);
    const weekStart = addDays(round.startDate, weekIdx * 7);
    setWeightModalWeekIdx(weekIdx);
    setWeightModalDateInput(existing?.date ?? yyyyMmDd(weekStart));
    setWeightModalValueInput(existing ? existing.weight.toFixed(1) : "");
    setWeightModalOpen(true);
  }

  const confirmModal = confirmOpen ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60"
        onClick={() => !loading && setConfirmOpen(false)}
      />
      <div className="relative w-[92vw] max-w-lg rounded-2xl border border-white/10 bg-[#111111]/80 p-5 shadow-xl backdrop-blur">
        <h3 className="text-lg font-semibold text-slate-100">Start a new round?</h3>
        <p className="mt-2 text-sm text-slate-300">
          Starting a new round makes previous rounds inactive and not editable.
        </p>

        <div className="mt-4">
          <label className="text-sm font-medium text-slate-200">Round length</label>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setRoundLengthWeeks(8)}
              className={`rounded-xl border border-white/10 px-3 py-2 text-sm font-semibold ${
                roundLengthWeeks === 8
                  ? "bg-sky-500 text-white"
                  : "bg-white/5 text-slate-100 hover:bg-white/10"
              }`}
            >
              8 weeks
            </button>
            <button
              type="button"
              onClick={() => setRoundLengthWeeks(4)}
              className={`rounded-xl border border-white/10 px-3 py-2 text-sm font-semibold ${
                roundLengthWeeks === 4
                  ? "bg-sky-500 text-white"
                  : "bg-white/5 text-slate-100 hover:bg-white/10"
              }`}
            >
              4 weeks
            </button>
          </div>
        </div>

        <div className="mt-4">
          <label className="text-sm font-medium text-slate-200">Start date</label>
          <input
            type="date"
            value={startDateInput}
            onChange={(e) => setStartDateInput(e.target.value)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-slate-100 outline-none focus:border-sky-400/50"
            style={{ colorScheme: "dark" }}
          />
        </div>

            <div className="mt-4">
              <label className="text-sm font-medium text-slate-200">Goal weight</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0"
                value={goalWeightInput}
                onChange={(e) => setGoalWeightInput(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-slate-100 outline-none focus:border-sky-400/50"
                placeholder={`Optional (${weightUnit === "KG" ? "kg" : "lbs"})`}
              />
            </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10 disabled:opacity-60"
            onClick={() => setConfirmOpen(false)}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-400 disabled:opacity-60"
            onClick={confirmStartRound}
            disabled={loading}
          >
            {loading ? "Starting..." : "Start round"}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  if (!initialRoundResolved) {
    return (
      <main className="mx-auto max-w-5xl px-5 py-8">
        <div className="text-sm text-slate-400">Loading tracker...</div>
      </main>
    );
  }


  // If no round yet
  if (!round) {
    return (
      <main className="mx-auto max-w-5xl px-5 py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-100">
              {person?.name ?? "Person"}
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              {selectedTracker
                ? `Active tracker: ${formatTrackerLabel(selectedTracker)}`
                : "No tracker selected"}
            </p>
          </div>
            {!hideControls && (
              <div className="flex gap-2">
                <Link 
                  href={joinIngressPath(ingressPrefix, "/people")}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-slate-100 hover:bg-white/10"
                >
                  ← People
                </Link>
                <Link 
                  href={joinIngressPath(ingressPrefix, "/admin")}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-slate-100 hover:bg-white/10"
                >
                  Admin
                </Link>
                <Link 
                  href={joinIngressPath(ingressPrefix, "/help")}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-slate-100 hover:bg-white/10"
                >
                  Help
                </Link>
              </div>
            )}
        </div>

        <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {showTrackerSwitcher ? "Active tracker" : "Tracker"}
          </div>
          <div className="mt-2 flex items-center gap-2">
            {showTrackerSwitcher ? (
              <select
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#111111] text-slate-100 px-3 py-2 text-sm outline-none focus:border-sky-400/60 focus:ring-4 focus:ring-sky-400/10"
                value={selectedTrackerId}
                onChange={(e) => setSelectedTrackerId(e.target.value)}
                style={{ colorScheme: "dark" }}
                disabled={trackers.length === 0 || loading || trackerBusy}
              >
                {trackers.map((t) => (
                  <option key={t.id} className="bg-[#111111] text-slate-100" value={t.id}>
                    {formatTrackerLabel(t)}
                  </option>
                ))}
              </select>
            ) : (
              <div className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#111111]/40 px-3 py-2 text-sm text-slate-100">
                {formatTrackerLabel(selectedTracker)}
              </div>
            )}
            {!hideControls && trackers.length > 0 && (
              <button
                onClick={() => setShowAddTrackerControls((prev) => !prev)}
                disabled={trackerBusy || loading}
                className="inline-flex shrink-0 whitespace-nowrap items-center justify-center rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10 disabled:opacity-50"
              >
                {showAddTrackerPanel ? "Cancel" : "Add another tracker"}
              </button>
            )}
          </div>

          <button
            onClick={openNewRoundPrompt}
            disabled={loading || !selectedTrackerId}
            className="mt-3 inline-flex w-full items-center justify-center rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Starting..." : "Start New Round"}
          </button>

          {showAddTrackerPanel && (
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr,auto]">
              <select
                className="rounded-xl border border-white/10 bg-[#111111] text-slate-100 px-3 py-2 text-sm outline-none focus:border-emerald-400/60 focus:ring-4 focus:ring-emerald-400/10"
                value={newTrackerTypeId}
                onChange={(e) => setNewTrackerTypeId(e.target.value)}
                style={{ colorScheme: "dark" }}
                disabled={trackerTypes.length === 0 || trackerBusy || loading}
              >
                {trackerTypes.length === 0 ? (
                  <option className="bg-[#111111] text-slate-100" value="">
                    No tracker types available
                  </option>
                ) : (
                  trackerTypes.map((tt) => (
                    <option key={tt.id} className="bg-[#111111] text-slate-100" value={tt.id}>
                      {tt.name}
                    </option>
                  ))
                )}
              </select>
              <button
                onClick={createTracker}
                disabled={!newTrackerTypeId || trackerBusy || loading}
                className="inline-flex items-center justify-center rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {trackerBusy ? "Adding..." : "Add Tracker"}
              </button>
            </div>
          )}

          <p className="mt-4 text-sm text-slate-400">
            {selectedTracker
              ? `No rounds yet for tracker "${selectedTracker.name}".`
              : "No active trackers yet. Add one to start tracking."}
          </p>
        </section>

        {confirmModal}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1200px] px-5 py-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-100">
            {person?.name ?? "Person"}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {selectedTracker
              ? `Tracker: ${formatTrackerLabel(selectedTracker)} • `
              : ""}
            Active round • Start: {round.startDate} • {round.lengthWeeks} weeks
            {roundNumber > 0 ? ` • Round ${roundNumber}` : ""}
          </p>
          <p className="mt-1 text-sm font-medium text-slate-400">
            Weeks start on {weekStartDayLabel(round.startDate)}.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {!hideControls && (
            <>
              <Link
                href={joinIngressPath(ingressPrefix, "/people")}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-slate-100 hover:bg-white/10"
              >
                ← People
              </Link>
              <Link
                href={joinIngressPath(ingressPrefix, "/help")}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-slate-100 hover:bg-white/10"
              >
                Help
              </Link>

            <button
              onClick={openEditStartPrompt}
              disabled={loading}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-slate-100 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              title="Edit start date or goal weight"
            >
              Edit Round
            </button>
            </>
          )}

          <button
            onClick={openNewRoundPrompt}
            disabled={loading || !selectedTrackerId}
            className="rounded-xl bg-sky-500 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
            title="Start a new round (creates a fresh one)"
          >
            {loading ? "Starting..." : "New Round"}
          </button>
        </div>
      </div>

      {!hideControls && (
        <section className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {showTrackerSwitcher ? "Active tracker" : "Tracker"}
          </div>
          <div className="mt-2 flex items-center gap-2">
            {showTrackerSwitcher ? (
              <select
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#111111] text-slate-100 px-3 py-2 text-sm outline-none focus:border-sky-400/60 focus:ring-4 focus:ring-sky-400/10"
                value={selectedTrackerId}
                onChange={(e) => setSelectedTrackerId(e.target.value)}
                style={{ colorScheme: "dark" }}
                disabled={trackers.length === 0 || loading || trackerBusy}
              >
                {trackers.map((t) => (
                  <option key={t.id} className="bg-[#111111] text-slate-100" value={t.id}>
                    {formatTrackerLabel(t)}
                  </option>
                ))}
              </select>
            ) : (
              <div className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#111111]/40 px-3 py-2 text-sm text-slate-100">
                {formatTrackerLabel(selectedTracker)}
              </div>
            )}
            {!hideControls && trackers.length > 0 && (
              <button
                onClick={() => setShowAddTrackerControls((prev) => !prev)}
                disabled={trackerBusy || loading}
                className="inline-flex shrink-0 whitespace-nowrap items-center justify-center rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10 disabled:opacity-50"
              >
                {showAddTrackerPanel ? "Cancel" : "Add another tracker"}
              </button>
            )}
          </div>

          {showAddTrackerPanel && (
            <div className="mt-3 grid grid-cols-[1fr,auto] gap-2">
              <select
                className="rounded-xl border border-white/10 bg-[#111111] text-slate-100 px-3 py-2 text-sm outline-none focus:border-emerald-400/60 focus:ring-4 focus:ring-emerald-400/10"
                value={newTrackerTypeId}
                onChange={(e) => setNewTrackerTypeId(e.target.value)}
                style={{ colorScheme: "dark" }}
                disabled={trackerTypes.length === 0 || trackerBusy || loading}
              >
                {trackerTypes.length === 0 ? (
                  <option className="bg-[#111111] text-slate-100" value="">
                    No tracker types
                  </option>
                ) : (
                  trackerTypes.map((tt) => (
                    <option key={tt.id} className="bg-[#111111] text-slate-100" value={tt.id}>
                      {tt.name}
                    </option>
                  ))
                )}
              </select>
              <button
                onClick={createTracker}
                disabled={!newTrackerTypeId || trackerBusy || loading}
                className="inline-flex items-center justify-center rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {trackerBusy ? "Adding..." : "Add"}
              </button>
            </div>
          )}
        </section>
      )}

      <RoundWheel
        roundId={round.id}
        roundNumber={roundNumber || 1}
        personName={person?.name}
        startDate={round.startDate}
        lengthWeeks={round.lengthWeeks}
        categories={round.roundCategories}
        entries={round.entries}
        weightEntries={round.weightEntries}
        weightUnit={weightUnit}
        onWeekWeightClick={openWeightModal}
        onCellClick={cycle}
      />

      <RoundSummaryPanel
        round={round}
        completedWeeks={completedWeeksForRound(round.startDate, round.lengthWeeks)}
        title="Summary (completed weeks)"
      />

      <WeightChart
        lengthWeeks={round.lengthWeeks}
        weightEntries={round.weightEntries ?? []}
        goalWeight={round.goalWeight ?? null}
        weightUnit={weightUnit}
      />

      <StatusLegend />

      {/* Round History */}
      <section className="mx-auto mt-8 w-full max-w-[1200px]">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Round history</h2>
            <p className="mt-1 text-sm text-slate-400">
              Completed rounds (read-only). Click a round to view.
            </p>
          </div>

          {historyLoading && (
            <div className="text-sm text-slate-400">Loading…</div>
          )}
        </div>

        {inactiveRounds.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-slate-400">
            No previous rounds yet.
          </div>
        ) : (
          <div className="mt-4 overflow-x-hidden rounded-2xl border border-white/10 bg-white/5">
            <table className="w-full table-fixed border-collapse">
              <thead className="bg-white/5">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-300">
                  <th className="px-4 py-3">Round</th>
                  <th className="px-4 py-3">Start</th>
                  <th className="px-4 py-3">End</th>
                  <th className="px-4 py-3">Weeks</th>
                  <th className="px-4 py-3">Total %</th>
                  {round.roundCategories.map((c) => (
                    <th key={c.categoryId} className="px-4 py-3">
                      {c.displayName} %
                    </th>
                  ))}
                  <th className="px-3 py-3">Delete</th>
                </tr>
              </thead>

              <tbody>
                {inactiveRounds.map((r) => {
                  const start = parseLocalDay(r.startDate);
                  const end = new Date(start);
                  end.setDate(end.getDate() + r.lengthWeeks * 7 - 1);

                  const fmt = (d: Date) => {
                    const mm = String(d.getMonth() + 1).padStart(2, "0");
                    const dd = String(d.getDate()).padStart(2, "0");
                    const yy = String(d.getFullYear()).slice(2);
                    return `${mm}/${dd}/${yy}`;
                  };

                  const totalPct = calcTotalPercent(r);

                  return (
                    <tr key={r.id} className="border-t border-white/10 text-sm text-slate-200">
                      <td className="px-3 py-2">
                        <button
                          className="text-sky-300 hover:text-sky-200 underline underline-offset-2 whitespace-nowrap"
                          onClick={() => setOpenRound(r)}
                        >
                          Round {r.roundNumber}
                        </button>
                      </td>

                      <td className="px-3 py-2 text-slate-300 whitespace-nowrap">{fmt(start)}</td>
                      <td className="px-3 py-2 text-slate-300 whitespace-nowrap">{fmt(end)}</td>
                      <td className="px-3 py-2 text-slate-300 whitespace-nowrap">{r.lengthWeeks}w</td>

                      {/* Total % */}
                      <td className="px-3 py-2">
                        <CompactPct pct={totalPct} tone="total" />
                      </td>

                      {/* Per-category % */}
                      {round.roundCategories.map((c) => {
                        const match = r.roundCategories.find((rc) => rc.categoryId === c.categoryId);
                        const allowed = match?.allowDaysOffPerWeek ?? 0;
                        const pct = calcCategoryPercent(r, c.categoryId, allowed);
                        return (
                          <td key={`${r.id}-${c.categoryId}`} className="px-3 py-2">
                            <CompactPct pct={pct} tone="cat" />
                          </td>
                        );
                      })}
                      <td className="px-3 py-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openDeletePrompt(
                              r.id,
                              r.roundNumber,
                              r.tracker?.name ?? selectedTracker?.name ?? "Tracker"
                            );
                          }}
                          className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs font-semibold text-rose-200 hover:bg-white/10"
                          title="Delete this round"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}


              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Round View Modal */}
      {openRound && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => setOpenRound(null)}
          />
          <div className="relative w-[96vw] max-w-[980px] rounded-2xl border border-white/10 bg-[#111111]/85 p-5 shadow-2xl backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-100">
                  {person?.name ?? "Person"} — Round {openRound.roundNumber}
                </h3>
                <p className="mt-1 text-sm text-slate-400">
                  Start: {openRound.startDate} • {openRound.lengthWeeks} weeks • Read-only
                </p>
                <p className="mt-1 text-sm font-medium text-slate-400">
                  Weeks start on {weekStartDayLabel(openRound.startDate)}.
                </p>
              </div>

              <button
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10"
                onClick={() => setOpenRound(null)}
              >
                Close
              </button>
            </div>

            {/* Read-only: pointer-events-none prevents clicking */}
            <div className="mt-4 pointer-events-none">
              <RoundWheel
                roundId={openRound.id}
                roundNumber={openRound.roundNumber}
                personName={person?.name}
                startDate={String(openRound.startDate)}
                lengthWeeks={openRound.lengthWeeks}
                categories={openRound.roundCategories}
                entries={openRound.entries}
                weightEntries={openRound.weightEntries}
                weightUnit={weightUnit}
                onCellClick={() => {}}
              />
            </div>
            <RoundSummaryPanel
              round={openRound}
              completedWeeks={openRound.lengthWeeks}
              title="Summary (full round)"
            />
            <WeightChart
              lengthWeeks={openRound.lengthWeeks}
              weightEntries={openRound.weightEntries ?? []}
              title="Weight by week (history)"
              goalWeight={openRound.goalWeight ?? null}
              weightUnit={weightUnit}
            />
          </div>
        </div>
      )}

      {weightModalOpen && weightModalWeekIdx !== null && round && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => !weightSaving && setWeightModalOpen(false)}
          />
          <div className="relative w-[92vw] max-w-lg rounded-2xl border border-white/10 bg-[#111111]/80 p-5 shadow-xl backdrop-blur">
            <h3 className="text-lg font-semibold text-slate-100">
              Week {weightModalWeekIdx + 1} weight
            </h3>
            {weightWeekRange && (
              <p className="mt-1 text-sm text-slate-400">
                {weightWeekRange.label}
              </p>
            )}
            <p className="mt-2 text-xs text-slate-400">
              One entry per week. You can choose any day within this week.
            </p>

            <div className="mt-4">
              <label className="text-sm font-medium text-slate-200">Date</label>
              <input
                type="date"
                value={weightModalDateInput}
                min={weightWeekRange ? yyyyMmDd(weightWeekRange.start) : undefined}
                max={weightWeekRange ? yyyyMmDd(weightWeekRange.end) : undefined}
                onChange={(e) => setWeightModalDateInput(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-slate-100 outline-none focus:border-sky-400/50"
                style={{ colorScheme: "dark" }}
              />
            </div>

            <div className="mt-4">
              <label className="text-sm font-medium text-slate-200">Weight</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0"
                value={weightModalValueInput}
                onChange={(e) => setWeightModalValueInput(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-slate-100 outline-none focus:border-sky-400/50"
                placeholder={`e.g., 182.4 (${weightUnit === "KG" ? "kg" : "lbs"})`}
              />
            </div>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10 disabled:opacity-60"
                onClick={() => setWeightModalOpen(false)}
                disabled={weightSaving}
              >
                Cancel
              </button>
              <button
                className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-400 disabled:opacity-60"
                onClick={saveWeight}
                disabled={weightSaving}
              >
                {weightSaving ? "Saving..." : "Save weight"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmModal}
      {editStartOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => !loading && setEditStartOpen(false)}
          />
          <div className="relative w-[92vw] max-w-lg rounded-2xl border border-white/10 bg-[#111111]/80 p-5 shadow-xl backdrop-blur">
            <h3 className="text-lg font-semibold text-slate-100">Edit round start date</h3>
            <p className="mt-2 text-sm text-slate-300">
              This shifts every entry in the round by the same number of days.
            </p>

            <div className="mt-4">
              <label className="text-sm font-medium text-slate-200">Start date</label>
                <input
                  type="date"
                  value={editStartDateInput}
                  onChange={(e) => setEditStartDateInput(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-slate-100 outline-none focus:border-sky-400/50"
                  style={{ colorScheme: "dark" }}
                />
            </div>
            <div className="mt-4">
              <label className="text-sm font-medium text-slate-200">Goal weight</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0"
                value={editGoalWeightInput}
                onChange={(e) => setEditGoalWeightInput(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-slate-100 outline-none focus:border-sky-400/50"
                placeholder={`Optional (${weightUnit === "KG" ? "kg" : "lbs"})`}
              />
            </div>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10 disabled:opacity-60"
                onClick={() => setEditStartOpen(false)}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-400 disabled:opacity-60"
                onClick={confirmEditStartDate}
                disabled={loading}
              >
                {loading ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
      {deleteConfirmOpen && deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => !loading && setDeleteConfirmOpen(false)}
          />
          <div className="relative w-[92vw] max-w-lg rounded-2xl border border-white/10 bg-[#111111]/80 p-5 shadow-xl backdrop-blur">
            <h3 className="text-lg font-semibold text-slate-100">
              Delete {person?.name ?? "Person"} - {deleteTarget.trackerName} - Round {deleteTarget.roundNumber}?
            </h3>

            <p className="mt-2 text-sm text-slate-300">
              This permanently deletes the round and all of its entries. This cannot be undone.
            </p>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10 disabled:opacity-60"
                onClick={() => setDeleteConfirmOpen(false)}
                disabled={loading}
              >
                Cancel
              </button>

              <button
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-60"
                onClick={confirmDeleteRound}
                disabled={loading}
              >
                {loading ? "Deleting..." : "Delete round"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
