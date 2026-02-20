import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RoundCategoryRow = {
  categoryId: string;
  displayName: string;
  category: { allowDaysOffPerWeek: number; allowTreat: boolean; allowSick: boolean };
};
type EntryRow = { categoryId: string; date: Date; status: string };
type WeightRow = { weekIndex: number; weight: number; date: Date };

type RoundRaw = {
  id: string;
  startDate: Date;
  lengthWeeks: number;
  goalWeight: number | null;
  createdAt: Date;
  trackerId: string;
  tracker: {
    id: string;
    name: string;
    trackerType: { id: string; name: string };
  };
  roundCategories: RoundCategoryRow[];
  entries: EntryRow[];
  weightEntries: WeightRow[];
};

type RoundHistoryItem = {
  id: string;
  startDate: string; // YYYY-MM-DD
  lengthWeeks: number;
  goalWeight: number | null;
  createdAt: string; // ISO timestamp
  trackerId: string;
  tracker: {
    id: string;
    name: string;
    trackerTypeId: string;
    trackerTypeName: string;
  };
  roundNumber: number;
  roundCategories: {
    categoryId: string;
    displayName: string;
    allowDaysOffPerWeek: number;
    allowTreat: boolean;
    allowSick: boolean;
  }[];
  entries: { categoryId: string; date: string; status: string }[]; // date = YYYY-MM-DD
  weightEntries: { weekIndex: number; weight: number; date: string }[];
};

function ymd(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ personId: string }> }
) {
  const { personId } = await ctx.params;
  const { searchParams } = new URL(req.url);
  const trackerId = searchParams.get("trackerId")?.trim();

  if (!personId) {
    return NextResponse.json({ error: "personId is required" }, { status: 400 });
  }

  if (trackerId) {
    const tracker = await prisma.tracker.findUnique({
      where: { id: trackerId },
      select: { id: true, personId: true },
    });
    if (!tracker || tracker.personId !== personId) {
      return NextResponse.json({ error: "Tracker not found for person" }, { status: 404 });
    }
  }

  const roundsRaw = (await prisma.round.findMany({
    where: { personId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      startDate: true,
      lengthWeeks: true,
      goalWeight: true,
      createdAt: true,
      trackerId: true,
      tracker: {
        select: {
          id: true,
          name: true,
          trackerType: { select: { id: true, name: true } },
        },
      },
      roundCategories: {
        orderBy: { sortOrder: "asc" },
        select: {
          categoryId: true,
          displayName: true,
          category: { select: { allowDaysOffPerWeek: true, allowTreat: true, allowSick: true } },
        },
      },
      entries: {
        select: { categoryId: true, date: true, status: true },
      },
      weightEntries: {
        select: { weekIndex: true, weight: true, date: true },
        orderBy: { weekIndex: "asc" },
      },
    },
  })) as RoundRaw[];

  const roundsBase = roundsRaw.map((r: RoundRaw) => ({
    id: r.id,
    startDate: ymd(r.startDate),
    lengthWeeks: r.lengthWeeks,
    goalWeight: r.goalWeight ?? null,
    createdAt: r.createdAt.toISOString(),
    trackerId: r.trackerId,
    tracker: {
      id: r.tracker.id,
      name: r.tracker.name,
      trackerTypeId: r.tracker.trackerType.id,
      trackerTypeName: r.tracker.trackerType.name,
    },
    roundCategories: r.roundCategories.map((c: RoundCategoryRow) => ({
      categoryId: c.categoryId,
      displayName: c.displayName,
      allowDaysOffPerWeek: c.category?.allowDaysOffPerWeek ?? 0,
      allowTreat: c.category?.allowTreat ?? true,
      allowSick: c.category?.allowSick ?? true,
    })),
    entries: r.entries.map((e: EntryRow) => ({
      categoryId: e.categoryId,
      date: ymd(e.date),
      status: e.status,
    })),
    weightEntries: r.weightEntries.map((w: WeightRow) => ({
      weekIndex: w.weekIndex,
      weight: w.weight,
      date: ymd(w.date),
    })),
  }));

  const typeCounts = new Map<string, number>();
  const withNumbersAll: RoundHistoryItem[] = roundsBase.map((r) => {
    const typeKey = r.tracker.trackerTypeId;
    const next = (typeCounts.get(typeKey) ?? 0) + 1;
    typeCounts.set(typeKey, next);
    return {
      ...r,
      roundNumber: next,
    };
  });

  const filtered = trackerId
    ? withNumbersAll.filter((r) => r.trackerId === trackerId)
    : withNumbersAll;

  return NextResponse.json(filtered);
}
