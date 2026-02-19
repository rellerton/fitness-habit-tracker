import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

  const tracker = trackerId
    ? await prisma.tracker.findUnique({
        where: { id: trackerId },
        select: {
          id: true,
          personId: true,
          name: true,
          trackerTypeId: true,
          trackerType: { select: { name: true } },
        },
      })
    : await prisma.tracker.findFirst({
        where: { personId, active: true },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          personId: true,
          name: true,
          trackerTypeId: true,
          trackerType: { select: { name: true } },
        },
      });

  if (!tracker || tracker.personId !== personId) {
    return NextResponse.json({ round: null, roundNumber: 0, tracker: null });
  }

  const latest = await prisma.round.findFirst({
    where: { personId, trackerId: tracker.id },
    orderBy: { createdAt: "desc" },
    include: {
      roundCategories: {
        orderBy: { sortOrder: "asc" },
        select: {
          categoryId: true,
          displayName: true,
          category: { select: { allowDaysOffPerWeek: true } },
        },
      },
      entries: true,
      weightEntries: {
        select: { weekIndex: true, weight: true, date: true },
        orderBy: { weekIndex: "asc" },
      },
    },
  });

  if (!latest) {
    return NextResponse.json({
      round: null,
      roundNumber: 0,
      tracker: {
        id: tracker.id,
        name: tracker.name,
        trackerTypeId: tracker.trackerTypeId,
        trackerTypeName: tracker.trackerType.name,
      },
    });
  }

  const typeRoundIds = await prisma.round.findMany({
    where: {
      personId,
      tracker: { trackerTypeId: tracker.trackerTypeId },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true },
  });
  const roundNumber = typeRoundIds.findIndex((r) => r.id === latest.id) + 1;

  const normalized = {
    ...latest,
    startDate: ymd(latest.startDate),
    goalWeight: latest.goalWeight ?? null,
    roundCategories: latest.roundCategories.map((c) => ({
      categoryId: c.categoryId,
      displayName: c.displayName,
      allowDaysOffPerWeek: c.category?.allowDaysOffPerWeek ?? 0,
    })),
    // Normalize entry dates too so the UI never sees "...Z"
    entries: latest.entries.map((e) => ({
      ...e,
      date: ymd(e.date),
    })),
    weightEntries: latest.weightEntries.map((w) => ({
      weekIndex: w.weekIndex,
      weight: w.weight,
      date: ymd(w.date),
    })),
  };

  return NextResponse.json({
    round: normalized,
    roundNumber: roundNumber > 0 ? roundNumber : 0,
    tracker: {
      id: tracker.id,
      name: tracker.name,
      trackerTypeId: tracker.trackerTypeId,
      trackerTypeName: tracker.trackerType.name,
    },
  });
}
