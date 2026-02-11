"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiUrl, joinIngressPath, useIngressPrefix } from "@/lib/ingress";

type Person = { id: string; name: string };
type Category = { id: string; name: string; sortOrder: number; allowDaysOffPerWeek: number };

type RoundHistoryItem = {
  id: string;
  startDate: string;
  lengthWeeks: number;
  createdAt: string;
  roundNumber: number;
  roundCategories: { categoryId: string; displayName: string }[];
  entries: { categoryId: string; date: string; status: string }[];
};

const MAX_ACTIVE_CATEGORIES = 5;

export default function AdminPage() {
  const ingressPrefix = useIngressPrefix();
  const homeHref = (() => {
    const href = joinIngressPath(ingressPrefix, "/");
    return href.endsWith("/") ? href : `${href}/`;
  })();

  const [people, setPeople] = useState<Person[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [personName, setPersonName] = useState("");
  const [catName, setCatName] = useState("");
  const [catDaysOff, setCatDaysOff] = useState<number>(0);
  const [applyCatToExisting, setApplyCatToExisting] = useState(false);
  const [busy, setBusy] = useState<"person" | "category" | "settings" | null>(null);
  const [weightUnit, setWeightUnit] = useState<"LBS" | "KG">("LBS");

  const [expandedPersonId, setExpandedPersonId] = useState<string | null>(null);
  const [roundsByPerson, setRoundsByPerson] = useState<Record<string, RoundHistoryItem[]>>({});
  const [roundsLoading, setRoundsLoading] = useState<Record<string, boolean>>({});

  const [deleteRoundOpen, setDeleteRoundOpen] = useState(false);
  const [deleteRoundTarget, setDeleteRoundTarget] = useState<{
    roundId: string;
    personId: string;
    personName: string;
    roundNumber: number;
  } | null>(null);

  const [deletePersonOpen, setDeletePersonOpen] = useState(false);
  const [deletePersonTarget, setDeletePersonTarget] = useState<Person | null>(null);
  const [editPersonOpen, setEditPersonOpen] = useState(false);
  const [editPersonTarget, setEditPersonTarget] = useState<Person | null>(null);
  const [editPersonName, setEditPersonName] = useState("");

  const [deleteCatOpen, setDeleteCatOpen] = useState(false);
  const [deleteCatTarget, setDeleteCatTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteCatRemoveFromActive, setDeleteCatRemoveFromActive] = useState(false);
  const [editCatOpen, setEditCatOpen] = useState(false);
  const [editCatTarget, setEditCatTarget] = useState<{ id: string; name: string } | null>(null);
  const [editCatName, setEditCatName] = useState("");
  const [editCatDaysOff, setEditCatDaysOff] = useState<number>(0);
  const [applyEditCatToExisting, setApplyEditCatToExisting] = useState(false);

  const canAddPerson = useMemo(() => personName.trim().length > 0, [personName]);
  const canAddCategory = useMemo(
    () => catName.trim().length > 0 && cats.length < MAX_ACTIVE_CATEGORIES,
    [catName, cats.length]
  );

  async function fetchJson(path: string, options: RequestInit = {}) {
    const res = await fetch(apiUrl(path), options);
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`${res.status} ${res.statusText}${txt ? ` - ${txt}` : ""}`);
    }
    return res.json();
  }

  async function refresh() {
    const [p, c, s] = await Promise.all([
      fetchJson("people"),
      fetchJson("categories"),
      fetchJson("settings"),
    ]);

    setPeople(Array.isArray(p) ? p : []);

    const catsArr = Array.isArray(c) ? c : [];
    catsArr.sort((a: Category, b: Category) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    setCats(catsArr);
    if (s?.weightUnit === "KG" || s?.weightUnit === "LBS") {
      setWeightUnit(s.weightUnit);
    }
  }

  useEffect(() => {
    refresh().catch((e) => {
      console.error("[AdminPage] refresh failed:", e);
    });
  }, []);

  async function addPerson() {
    const name = personName.trim();
    if (!name) return;

    setBusy("person");
    try {
      await fetchJson("people", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      setPersonName("");
      await refresh();
    } catch (e) {
      console.error(e);
      alert(`Failed to add person: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setBusy(null);
    }
  }

  function openEditPerson(person: Person) {
    setEditPersonTarget(person);
    setEditPersonName(person.name);
    setEditPersonOpen(true);
  }

  async function confirmEditPerson() {
    if (!editPersonTarget) return;

    const name = editPersonName.trim();
    if (!name) {
      alert("Name is required.");
      return;
    }

    setBusy("person");
    try {
      await fetchJson(`people/${editPersonTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      setEditPersonOpen(false);
      setEditPersonTarget(null);
      await refresh();
    } catch (e) {
      console.error(e);
      alert(`Update failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setBusy(null);
    }
  }

  function openDeletePerson(person: Person) {
    setDeletePersonTarget(person);
    setDeletePersonOpen(true);
  }

  async function confirmDeletePerson() {
    if (!deletePersonTarget) return;

    setBusy("person");
    try {
      await fetchJson(`people/${deletePersonTarget.id}`, { method: "DELETE" });
      setDeletePersonOpen(false);
      setDeletePersonTarget(null);
      setExpandedPersonId((prev) => (prev === deletePersonTarget.id ? null : prev));
      setRoundsByPerson((prev) => {
        const next = { ...prev };
        delete next[deletePersonTarget.id];
        return next;
      });
      await refresh();
    } catch (e) {
      console.error(e);
      alert(`Delete failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setBusy(null);
    }
  }

  async function addCategory() {
    const name = catName.trim();
    if (!name) return;
    if (cats.length >= MAX_ACTIVE_CATEGORIES) {
      alert(`Max ${MAX_ACTIVE_CATEGORIES} categories reached.`);
      return;
    }
    if (catDaysOff < 0 || catDaysOff > 5) {
      alert("Days off per week must be 0-5.");
      return;
    }

    setBusy("category");
    try {
      await fetchJson("categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          allowDaysOffPerWeek: catDaysOff,
          applyToExisting: applyCatToExisting,
        }),
      });
      setCatName("");
      setCatDaysOff(0);
      setApplyCatToExisting(false);
      await refresh();
    } catch (e) {
      console.error(e);
      alert(`Failed to add category: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setBusy(null);
    }
  }

  async function reorderCategory(categoryId: string, direction: "up" | "down") {
    setBusy("category");
    try {
      await fetchJson("categories/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId, direction }),
      });
      await refresh();
    } catch (e) {
      console.error(e);
      alert(`Reorder failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setBusy(null);
    }
  }

  function openDeleteCategory(id: string, name: string) {
    setDeleteCatTarget({ id, name });
    setDeleteCatRemoveFromActive(false);
    setDeleteCatOpen(true);
  }

  function openEditCategory(id: string, name: string, daysOff: number) {
    setEditCatTarget({ id, name });
    setEditCatName(name);
    setEditCatDaysOff(daysOff);
    setApplyEditCatToExisting(false);
    setEditCatOpen(true);
  }

  async function confirmEditCategory() {
    if (!editCatTarget) return;

    const name = editCatName.trim();
    if (!name) {
      alert("Category name is required.");
      return;
    }
    if (editCatDaysOff < 0 || editCatDaysOff > 5) {
      alert("Days off per week must be 0-5.");
      return;
    }

    setBusy("category");
    try {
      await fetchJson(`categories/${editCatTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          allowDaysOffPerWeek: editCatDaysOff,
          applyToExisting: applyEditCatToExisting,
        }),
      });
      setEditCatOpen(false);
      setEditCatTarget(null);
      setApplyEditCatToExisting(false);
      await refresh();
    } catch (e) {
      console.error(e);
      alert(`Update failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setBusy(null);
    }
  }

  async function confirmDeleteCategory() {
    if (!deleteCatTarget) return;

    setBusy("category");
    try {
      await fetchJson(`categories/${deleteCatTarget.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ removeFromActiveRounds: deleteCatRemoveFromActive }),
      });
      setDeleteCatOpen(false);
      setDeleteCatTarget(null);
      setDeleteCatRemoveFromActive(false);
      await refresh();
    } catch (e) {
      console.error(e);
      alert(`Delete failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setBusy(null);
    }
  }

  async function saveSettings() {
    setBusy("settings");
    try {
      await fetchJson("settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weightUnit }),
      });
      await refresh();
    } catch (e) {
      console.error(e);
      alert(`Failed to save settings: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setBusy(null);
    }
  }

  async function togglePerson(personId: string) {
    if (expandedPersonId === personId) {
      setExpandedPersonId(null);
      return;
    }

    setExpandedPersonId(personId);

    if (roundsByPerson[personId]) return;

    setRoundsLoading((prev) => ({ ...prev, [personId]: true }));
    try {
      const data = await fetchJson(`people/${personId}/rounds`);

      if (!Array.isArray(data)) {
        setRoundsByPerson((prev) => ({ ...prev, [personId]: [] }));
        return;
      }

      setRoundsByPerson((prev) => ({ ...prev, [personId]: data }));
    } catch (e) {
      console.error("Failed to load rounds:", e);
      setRoundsByPerson((prev) => ({ ...prev, [personId]: [] }));
    } finally {
      setRoundsLoading((prev) => ({ ...prev, [personId]: false }));
    }
  }

  function openDeleteRound(person: Person, round: RoundHistoryItem) {
    setDeleteRoundTarget({
      roundId: round.id,
      personId: person.id,
      personName: person.name,
      roundNumber: round.roundNumber,
    });
    setDeleteRoundOpen(true);
  }

  async function confirmDeleteRound() {
    if (!deleteRoundTarget) return;

    setBusy("person");
    try {
      await fetchJson(`rounds/${deleteRoundTarget.roundId}`, { method: "DELETE" });

      const data2 = await fetchJson(`people/${deleteRoundTarget.personId}/rounds`);
      if (Array.isArray(data2)) {
        setRoundsByPerson((prev) => ({ ...prev, [deleteRoundTarget.personId]: data2 }));
      }

      setDeleteRoundOpen(false);
      setDeleteRoundTarget(null);
    } catch (e) {
      console.error(e);
      alert(`Delete failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-100">Admin</h1>
          <p className="mt-1 text-sm text-slate-400">Manage people, categories, and rounds.</p>
        </div>

        <div className="flex gap-2">
          <Link
            href={joinIngressPath(ingressPrefix, "/people")}
            className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-slate-100 hover:bg-white/10"
          >
            People
          </Link>
          <a
            href={homeHref}
            className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-slate-100 hover:bg-white/10"
          >
            Home
          </a>
        </div>
      </div>

      <div className="mt-7 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-sm">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-100">People</h2>
            <span className="rounded-full border border-white/10 bg-[#111111]/30 px-2.5 py-1 text-xs text-slate-300">
              {people.length} total
            </span>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              className="w-full rounded-xl border border-white/10 bg-[#111111]/40 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-sky-400/60 focus:ring-4 focus:ring-sky-400/10"
              value={personName}
              onChange={(e) => setPersonName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addPerson();
              }}
              placeholder="Name (e.g., Ryan)"
            />

            <button
              onClick={addPerson}
              disabled={!canAddPerson || busy !== null}
              className="inline-flex items-center justify-center rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy === "person" ? "Adding..." : "Add"}
            </button>
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-[#111111]/20">
            <ul className="divide-y divide-white/10">
              {people.map((p) => {
                const expanded = expandedPersonId === p.id;
                const rounds = roundsByPerson[p.id] ?? [];
                const isLoading = roundsLoading[p.id] === true;

                return (
                  <li key={p.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <button
                        className="flex w-full items-center justify-between gap-3 text-left"
                        onClick={() => togglePerson(p.id)}
                      >
                        <span className="font-medium text-slate-100">{p.name}</span>
                        <span className="text-xs text-slate-400">{expanded ? "Hide rounds" : "Show rounds"}</span>
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs font-semibold text-slate-200 hover:bg-white/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditPerson(p);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-xs font-semibold text-rose-200 hover:bg-rose-500/20"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDeletePerson(p);
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {expanded && (
                      <div className="mt-3 rounded-xl border border-white/10 bg-[#111111]/25 p-3">
                        {isLoading ? (
                          <div className="text-sm text-slate-400">Loading rounds…</div>
                        ) : rounds.length === 0 ? (
                          <div className="text-sm text-slate-400">No rounds yet.</div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full table-fixed border-collapse">
                              <thead>
                                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-300">
                                  <th className="py-2 pr-2 w-24">Round</th>
                                  <th className="py-2 pr-2 w-28">Start</th>
                                  <th className="py-2 pr-2 w-16">Weeks</th>
                                  <th className="py-2 pr-2 w-16">Delete</th>
                                </tr>
                              </thead>
                              <tbody>
                                {rounds.map((r) => (
                                  <tr key={r.id} className="border-t border-white/10 text-sm">
                                    <td className="py-2 pr-2 text-slate-200">Round {r.roundNumber}</td>
                                    <td className="py-2 pr-2 text-slate-400">{String(r.startDate).slice(0, 10)}</td>
                                    <td className="py-2 pr-2 text-slate-400">{r.lengthWeeks}</td>
                                    <td className="py-2 pr-2">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openDeleteRound(p, r);
                                        }}
                                        className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs font-semibold text-rose-200 hover:bg-white/10"
                                      >
                                        Delete
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>

                            <p className="mt-2 text-xs text-slate-500">Admin can delete any round (including most recent).</p>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}

              {people.length === 0 && (
                <li className="px-4 py-6 text-sm text-slate-400">No people yet. Add your first person above.</li>
              )}
            </ul>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-sm">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-100">Categories</h2>
            <span className="rounded-full border border-white/10 bg-[#111111]/30 px-2.5 py-1 text-xs text-slate-300">
              {cats.length} total
            </span>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              className="w-full rounded-xl border border-white/10 bg-[#111111]/40 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-emerald-400/60 focus:ring-4 focus:ring-emerald-400/10"
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addCategory();
              }}
              placeholder="Category (e.g., Cardio)"
            />
            <select
              className="rounded-xl border border-white/10 bg-[#111111] text-slate-100 px-3 py-2 text-sm outline-none focus:border-emerald-400/60 focus:ring-4 focus:ring-emerald-400/10"
              value={catDaysOff}
              onChange={(e) => setCatDaysOff(Number(e.target.value))}
              style={{ colorScheme: "dark" }}
            >
              <option className="bg-[#111111] text-slate-100" value={0}>0 days off/wk</option>
              <option className="bg-[#111111] text-slate-100" value={1}>1 day off/wk</option>
              <option className="bg-[#111111] text-slate-100" value={2}>2 days off/wk</option>
              <option className="bg-[#111111] text-slate-100" value={3}>3 days off/wk</option>
              <option className="bg-[#111111] text-slate-100" value={4}>4 days off/wk</option>
              <option className="bg-[#111111] text-slate-100" value={5}>5 days off/wk</option>
            </select>

            <button
              onClick={addCategory}
              disabled={!canAddCategory || busy !== null}
              className="inline-flex items-center justify-center rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy === "category" ? "Adding..." : "Add"}
            </button>
          </div>
          <label className="mt-2 flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border border-white/20 bg-[#111111]/60 text-emerald-400 focus:ring-emerald-400/30"
              checked={applyCatToExisting}
              onChange={(e) => setApplyCatToExisting(e.target.checked)}
              disabled={busy !== null}
            />
            Apply to latest rounds
          </label>
          <p className="mt-2 text-xs text-slate-500">
            Max {MAX_ACTIVE_CATEGORIES} categories. Delete one to add a new category.
          </p>

          <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-[#111111]/20">
            <ul className="divide-y divide-white/10">
              {cats.map((c, idx) => (
                <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <div className="font-medium text-slate-100 truncate">{c.name}</div>
                    <div className="text-xs text-slate-500">Sort: {c.sortOrder}</div>
                    <div className="text-xs text-slate-500">
                      Days off/week: {c.allowDaysOffPerWeek}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => reorderCategory(c.id, "up")}
                      disabled={idx === 0 || busy !== null}
                      className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs font-semibold text-slate-200 hover:bg-white/10 disabled:opacity-50"
                      title="Move up"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => reorderCategory(c.id, "down")}
                      disabled={idx === cats.length - 1 || busy !== null}
                      className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs font-semibold text-slate-200 hover:bg-white/10 disabled:opacity-50"
                      title="Move down"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => openEditCategory(c.id, c.name, c.allowDaysOffPerWeek)}
                      disabled={busy !== null}
                      className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs font-semibold text-slate-200 hover:bg-white/10 disabled:opacity-50"
                      title="Edit name"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => openDeleteCategory(c.id, c.name)}
                      disabled={busy !== null}
                      className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-xs font-semibold text-rose-200 hover:bg-rose-500/20 disabled:opacity-50"
                      title="Delete category"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}

              {cats.length === 0 && (
                <li className="px-4 py-6 text-sm text-slate-400">No categories yet. Add one above.</li>
              )}
            </ul>
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5 shadow-sm">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-100">Settings</h2>
          <span className="rounded-full border border-white/10 bg-[#111111]/30 px-2.5 py-1 text-xs text-slate-300">
            App
          </span>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="w-full sm:max-w-xs">
            <label className="text-sm font-medium text-slate-200">Weight unit</label>
            <select
              className="mt-2 w-full rounded-xl border border-white/10 bg-[#111111] text-slate-100 px-3 py-2 text-sm outline-none focus:border-sky-400/60 focus:ring-4 focus:ring-sky-400/10"
              value={weightUnit}
              onChange={(e) => setWeightUnit(e.target.value as "LBS" | "KG")}
              style={{ colorScheme: "dark" }}
              disabled={busy !== null}
            >
              <option className="bg-[#111111] text-slate-100" value="LBS">Lbs</option>
              <option className="bg-[#111111] text-slate-100" value="KG">Kg</option>
            </select>
          </div>

          <button
            onClick={saveSettings}
            disabled={busy !== null}
            className="inline-flex items-center justify-center rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy === "settings" ? "Saving..." : "Save settings"}
          </button>
        </div>
      </section>

      {editPersonOpen && editPersonTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => busy === null && setEditPersonOpen(false)} />
          <div className="relative w-[92vw] max-w-lg rounded-2xl border border-white/10 bg-[#111111]/80 p-5 shadow-xl backdrop-blur">
            <h3 className="text-lg font-semibold text-slate-100">Edit person</h3>
            <div className="mt-4">
              <label className="text-sm font-medium text-slate-200">Name</label>
              <input
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-slate-100 outline-none focus:border-sky-400/60"
                value={editPersonName}
                onChange={(e) => setEditPersonName(e.target.value)}
              />
            </div>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10 disabled:opacity-60"
                onClick={() => setEditPersonOpen(false)}
                disabled={busy !== null}
              >
                Cancel
              </button>

              <button
                className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-400 disabled:opacity-60"
                onClick={confirmEditPerson}
                disabled={busy !== null}
              >
                {busy === "person" ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deletePersonOpen && deletePersonTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => busy === null && setDeletePersonOpen(false)} />
          <div className="relative w-[92vw] max-w-lg rounded-2xl border border-white/10 bg-[#111111]/80 p-5 shadow-xl backdrop-blur">
            <h3 className="text-lg font-semibold text-slate-100">
              Delete {deletePersonTarget.name}?
            </h3>
            <p className="mt-2 text-sm text-slate-300">
              This permanently deletes the person and all of their rounds and entries. This cannot be undone.
            </p>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10 disabled:opacity-60"
                onClick={() => setDeletePersonOpen(false)}
                disabled={busy !== null}
              >
                Cancel
              </button>

              <button
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-60"
                onClick={confirmDeletePerson}
                disabled={busy !== null}
              >
                {busy === "person" ? "Deleting..." : "Delete person"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteRoundOpen && deleteRoundTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => busy === null && setDeleteRoundOpen(false)} />
          <div className="relative w-[92vw] max-w-lg rounded-2xl border border-white/10 bg-[#111111]/80 p-5 shadow-xl backdrop-blur">
            <h3 className="text-lg font-semibold text-slate-100">
              Delete {deleteRoundTarget.personName} — Round {deleteRoundTarget.roundNumber}?
            </h3>
            <p className="mt-2 text-sm text-slate-300">This permanently deletes the round and all entries. This cannot be undone.</p>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10 disabled:opacity-60"
                onClick={() => setDeleteRoundOpen(false)}
                disabled={busy !== null}
              >
                Cancel
              </button>

              <button
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-60"
                onClick={confirmDeleteRound}
                disabled={busy !== null}
              >
                {busy === "person" ? "Deleting..." : "Delete round"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editCatOpen && editCatTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => busy === null && setEditCatOpen(false)} />
          <div className="relative w-[92vw] max-w-lg rounded-2xl border border-white/10 bg-[#111111]/80 p-5 shadow-xl backdrop-blur">
            <h3 className="text-lg font-semibold text-slate-100">Edit category</h3>
            <p className="mt-2 text-sm text-slate-300">
              This updates the category name for future rounds. You can optionally apply the new name to the latest rounds.
            </p>

            <div className="mt-4">
              <label className="text-sm font-medium text-slate-200">Category name</label>
              <input
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-slate-100 outline-none focus:border-emerald-400/60"
                value={editCatName}
                onChange={(e) => setEditCatName(e.target.value)}
              />
            </div>
            <div className="mt-4">
              <label className="text-sm font-medium text-slate-200">Days off per week</label>
              <select
                className="mt-2 w-full rounded-xl border border-white/10 bg-[#111111] text-slate-100 px-3 py-2 outline-none focus:border-emerald-400/60"
                value={editCatDaysOff}
                onChange={(e) => setEditCatDaysOff(Number(e.target.value))}
                style={{ colorScheme: "dark" }}
              >
                <option className="bg-[#111111] text-slate-100" value={0}>0 days off/wk</option>
                <option className="bg-[#111111] text-slate-100" value={1}>1 day off/wk</option>
                <option className="bg-[#111111] text-slate-100" value={2}>2 days off/wk</option>
                <option className="bg-[#111111] text-slate-100" value={3}>3 days off/wk</option>
                <option className="bg-[#111111] text-slate-100" value={4}>4 days off/wk</option>
                <option className="bg-[#111111] text-slate-100" value={5}>5 days off/wk</option>
              </select>
            </div>
            <label className="mt-4 flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border border-white/20 bg-[#111111]/60 text-emerald-400 focus:ring-emerald-400/30"
                checked={applyEditCatToExisting}
                onChange={(e) => setApplyEditCatToExisting(e.target.checked)}
                disabled={busy !== null}
              />
              Apply name change to latest rounds
            </label>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10 disabled:opacity-60"
                onClick={() => setEditCatOpen(false)}
                disabled={busy !== null}
              >
                Cancel
              </button>

              <button
                className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400 disabled:opacity-60"
                onClick={confirmEditCategory}
                disabled={busy !== null}
              >
                {busy === "category" ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteCatOpen && deleteCatTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => busy === null && setDeleteCatOpen(false)} />
          <div className="relative w-[92vw] max-w-lg rounded-2xl border border-white/10 bg-[#111111]/80 p-5 shadow-xl backdrop-blur">
            <h3 className="text-lg font-semibold text-slate-100">Delete category "{deleteCatTarget.name}"?</h3>
            <p className="mt-2 text-sm text-slate-300">
              This hides the category from new rounds. Existing rounds keep their snapshot categories.
            </p>
            <label className="mt-4 flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border border-white/20 bg-[#111111]/60 text-rose-400 focus:ring-rose-400/30"
                checked={deleteCatRemoveFromActive}
                onChange={(e) => setDeleteCatRemoveFromActive(e.target.checked)}
                disabled={busy !== null}
              />
              Also remove from active rounds (deletes current-round entries)
            </label>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10 disabled:opacity-60"
                onClick={() => setDeleteCatOpen(false)}
                disabled={busy !== null}
              >
                Cancel
              </button>

              <button
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-60"
                onClick={confirmDeleteCategory}
                disabled={busy !== null}
              >
                {busy === "category" ? "Deleting..." : "Delete category"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
