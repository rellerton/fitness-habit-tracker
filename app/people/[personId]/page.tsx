"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import RoundWheel from "@/components/RoundWheel";
import StatusLegend from "@/components/StatusLegend";
import { useSearchParams } from "next/navigation";


type Person = { id: string; name: string };

type Category = { categoryId: string; displayName: string };

type RoundPayload = {
  id: string;
  startDate: string;
  lengthWeeks: number;
  roundCategories: Category[];
  entries: { categoryId: string; date: string; status: string }[];
};

type LatestRoundResponse = {
  round: RoundPayload | null;
  roundNumber: number;
};

type RoundHistoryItem = {
  id: string;
  startDate: string;
  lengthWeeks: number;
  active: boolean;
  createdAt: string;
  roundNumber: number;
  roundCategories: Category[];
  entries: { categoryId: string; date: string; status: string }[];
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



function calcCategoryPercent(round: Pick<RoundHistoryItem, "lengthWeeks" | "entries">, categoryId: string) {
  const totalDays = round.lengthWeeks * 7;
  if (totalDays <= 0) return 0;

  let score = 0;
  for (const e of round.entries) {
    if (e.categoryId !== categoryId) continue;
    const st = (e.status ?? "").toUpperCase();
    if (st === "DONE") score += 1;
    else if (st === "HALF") score += 0.5;
  }

  const pct = (score / totalDays) * 100;
  return Math.max(0, Math.min(100, pct));
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

function calcTotalPercent(
  r: Pick<RoundHistoryItem, "lengthWeeks" | "entries" | "roundCategories">
) {
  const totalDays = r.lengthWeeks * 7;
  const cats = r.roundCategories.length || 0;
  if (totalDays <= 0 || cats <= 0) return 0;

  let score = 0;
  for (const e of r.entries) {
    const st = (e.status ?? "").toUpperCase();
    if (st === "DONE") score += 1;
    else if (st === "HALF") score += 0.5;
  }

  const denom = totalDays * cats;
  return Math.max(0, Math.min(100, (score / denom) * 100));
}

function shouldHideControls(v: string | null) {
  if (!v) return false;
  const s = v.trim().toLowerCase();
  return s === "0" || s === "false" || s === "off" || s === "hide" || s === "no";
}

export default function PersonPage() {
  const routeParams = useParams<{ personId: string }>();
  const personId = routeParams.personId;

  const [person, setPerson] = useState<Person | null>(null);

  const [round, setRound] = useState<RoundPayload | null>(null);
  const [roundNumber, setRoundNumber] = useState<number>(0);

  const [history, setHistory] = useState<RoundHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [loading, setLoading] = useState(false);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; roundNumber: number } | null>(null);

  // modal
  const [openRound, setOpenRound] = useState<RoundHistoryItem | null>(null);

  // Hide controls query parameter
  const searchParams = useSearchParams();
  const hideControls = useMemo(
    () => shouldHideControls(searchParams.get("controls")),
    [searchParams]
  );

  async function loadPerson() {
    if (!personId) return;

    const res = await fetch(`/api/people/${personId}`);
    const data = await res.json().catch(() => null);

    if (res.ok && data?.id) {
      setPerson(data);
      return;
    }

    console.error("Failed to load person:", data);
    setPerson(null);
  }

  async function loadLatestRound() {
    if (!personId) return;

    const res = await fetch(`/api/people/${personId}/latest-round`);
    const data = (await res.json().catch(() => null)) as LatestRoundResponse | null;

    if (!res.ok) {
      console.error("Failed to load latest round:", data);
      return;
    }

    setRound(data?.round ?? null);
    setRoundNumber(typeof data?.roundNumber === "number" ? data.roundNumber : 0);
  }

  async function loadRoundHistory() {
    if (!personId) return;

    setHistoryLoading(true);
    const res = await fetch(`/api/people/${personId}/rounds`);
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

  function openNewRoundPrompt() {
    setStartDateInput(yyyyMmDd(new Date()));
    setConfirmOpen(true);
  }

  async function confirmStartRound() {
    if (!personId) return;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDateInput)) {
      alert("Please pick a valid start date.");
      return;
    }

    setLoading(true);

    const res = await fetch("api/rounds/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personId, startDate: startDateInput }),
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

  useEffect(() => {
    loadPerson();
    loadLatestRound();
    loadRoundHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personId]);

  async function cycle(roundId: string, categoryId: string, day: string) {
    const res = await fetch("api/entries", {
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

  function openDeletePrompt(id: string, roundNumber: number) {
    setDeleteTarget({ id, roundNumber });
    setDeleteConfirmOpen(true);
  }

  async function confirmDeleteRound() {
    if (!personId || !deleteTarget) return;

    setLoading(true);

    const res = await fetch(`/api/rounds/${deleteTarget.id}`, { method: "DELETE" });
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
              Start a new round to begin tracking.
            </p>
          </div>
            {!hideControls && (
              <div className="flex gap-2">
                <Link 
                  href="people"
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-slate-100 hover:bg-white/10"
                >
                  ← People
                </Link>
                <Link 
                  href="admin"
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-slate-100 hover:bg-white/10"
                >
                  Admin
                </Link>
              </div>
            )}
        </div>

        <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6 shadow-sm">
          <button
            onClick={openNewRoundPrompt}
            disabled={loading}
            className="inline-flex items-center justify-center rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Starting..." : "Start New Round"}
          </button>

          <p className="mt-4 text-sm text-slate-400">
            No rounds yet for this person.
          </p>
        </section>

        {/* Confirm Modal */}
        {confirmOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/60"
              onClick={() => !loading && setConfirmOpen(false)}
            />
            <div className="relative w-[92vw] max-w-lg rounded-2xl border border-white/10 bg-slate-950/80 p-5 shadow-xl backdrop-blur">
              <h3 className="text-lg font-semibold text-slate-100">Start a new round?</h3>
              <p className="mt-2 text-sm text-slate-300">
                Starting a new round makes previous rounds inactive and not editable.
              </p>

              <div className="mt-4">
                <label className="text-sm font-medium text-slate-200">Start date</label>
                <input
                  type="date"
                  value={startDateInput}
                  onChange={(e) => setStartDateInput(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-slate-100 outline-none focus:border-sky-400/50"
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
        )}
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
            Active round • Start: {round.startDate} • {round.lengthWeeks} weeks
            {roundNumber > 0 ? ` • Round ${roundNumber}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {!hideControls && (
            <Link
              href="."
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-slate-100 hover:bg-white/10"
            >
              ← People
            </Link>
          )}

          <button
            onClick={openNewRoundPrompt}
            disabled={loading}
            className="rounded-xl bg-sky-500 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
            title="Start a new round (creates a fresh one)"
          >
            {loading ? "Starting..." : "New Round"}
          </button>
        </div>
      </div>

      <RoundWheel
        roundId={round.id}
        roundNumber={roundNumber || 1}
        startDate={round.startDate}
        lengthWeeks={round.lengthWeeks}
        categories={round.roundCategories}
        entries={round.entries}
        onCellClick={cycle}
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

                  const totalPct = (() => {
                    const totalDays = r.lengthWeeks * 7;
                    const cats = r.roundCategories.length || 0;
                    if (totalDays <= 0 || cats <= 0) return 0;

                    let score = 0;
                    for (const e of r.entries) {
                      const st = (e.status ?? "").toUpperCase();
                      if (st === "DONE") score += 1;
                      else if (st === "HALF") score += 0.5;
                    }

                    const denom = totalDays * cats;
                    return Math.max(0, Math.min(100, (score / denom) * 100));
                  })();

                  const CompactPct = ({ pct, tone }: { pct: number; tone: "total" | "cat" }) => (
                    <div className="inline-flex items-center gap-1.5 whitespace-nowrap">
                      <div className="h-1.5 w-14 rounded-full bg-white/10">
                        <div
                          className={`h-1.5 rounded-full ${tone === "total" ? "bg-emerald-400/60" : "bg-sky-400/60"}`}
                          style={{ width: `${pct.toFixed(0)}%` }}
                        />
                      </div>
                      <span className="w-8 text-right text-xs tabular-nums text-slate-300">
                        {pct.toFixed(0)}%
                      </span>
                    </div>
                  );

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
                        const pct = calcCategoryPercent(r, c.categoryId);
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
                            openDeletePrompt(r.id, r.roundNumber);
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
          <div className="relative w-[96vw] max-w-[980px] rounded-2xl border border-white/10 bg-slate-950/85 p-5 shadow-2xl backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-100">
                  {person?.name ?? "Person"} — Round {openRound.roundNumber}
                </h3>
                <p className="mt-1 text-sm text-slate-400">
                  Start: {openRound.startDate} • {openRound.lengthWeeks} weeks • Read-only
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
                startDate={String(openRound.startDate)}
                lengthWeeks={openRound.lengthWeeks}
                categories={openRound.roundCategories}
                entries={openRound.entries}
                onCellClick={() => {}}
              />
            </div>
          </div>
        </div>
      )}

      {/* Confirm Modal (New Round) */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => !loading && setConfirmOpen(false)}
          />
          <div className="relative w-[92vw] max-w-lg rounded-2xl border border-white/10 bg-slate-950/80 p-5 shadow-xl backdrop-blur">
            <h3 className="text-lg font-semibold text-slate-100">Start a new round?</h3>
            <p className="mt-2 text-sm text-slate-300">
              Starting a new round makes previous rounds inactive and not editable.
            </p>

            <div className="mt-4">
              <label className="text-sm font-medium text-slate-200">Start date</label>
              <input
                type="date"
                value={startDateInput}
                onChange={(e) => setStartDateInput(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-slate-100 outline-none focus:border-sky-400/50"
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
      )}
      {deleteConfirmOpen && deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => !loading && setDeleteConfirmOpen(false)}
          />
          <div className="relative w-[92vw] max-w-lg rounded-2xl border border-white/10 bg-slate-950/80 p-5 shadow-xl backdrop-blur">
            <h3 className="text-lg font-semibold text-slate-100">
              Delete Round {deleteTarget.roundNumber}?
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
