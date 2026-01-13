import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RoundCategoryRow = { categoryId: string; displayName: string };
type EntryRow = { categoryId: string; date: Date; status: string };

type RoundRaw = {
  id: string;
  startDate: Date;
  lengthWeeks: number;
  createdAt: Date;
  roundCategories: RoundCategoryRow[];
  entries: EntryRow[];
};

type RoundHistoryItem = {
  id: string;
  startDate: string; // YYYY-MM-DD
  lengthWeeks: number;
  createdAt: string; // ISO timestamp
  roundNumber: number;
  roundCategories: RoundCategoryRow[];
  entries: { categoryId: string; date: string; status: string }[]; // date = YYYY-MM-DD
};

function ymd(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ personId: string }> }
) {
  const { personId } = await ctx.params;

  if (!personId) {
    return NextResponse.json({ error: "personId is required" }, { status: 400 });
  }

  const roundsRaw = (await prisma.round.findMany({
    where: { personId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      startDate: true,
      lengthWeeks: true,
      createdAt: true,
      roundCategories: {
        orderBy: { sortOrder: "asc" },
        select: { categoryId: true, displayName: true },
      },
      entries: {
        select: { categoryId: true, date: true, status: true },
      },
    },
  })) as RoundRaw[];

  const roundsBase = roundsRaw.map((r: RoundRaw) => ({
    id: r.id,
    startDate: ymd(r.startDate),
    lengthWeeks: r.lengthWeeks,
    createdAt: r.createdAt.toISOString(),
    roundCategories: r.roundCategories.map((c: RoundCategoryRow) => ({
      categoryId: c.categoryId,
      displayName: c.displayName,
    })),
    entries: r.entries.map((e: EntryRow) => ({
      categoryId: e.categoryId,
      date: ymd(e.date),
      status: e.status,
    })),
  }));

  const withNumbers: RoundHistoryItem[] = roundsBase.map((r, idx) => ({
    ...r,
    roundNumber: idx + 1,
  }));

  return NextResponse.json(withNumbers);
}
