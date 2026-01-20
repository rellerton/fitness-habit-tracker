import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

function ymd(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseLocalDay(s: string) {
  const ymdStr = String(s).slice(0, 10);
  const d = new Date(`${ymdStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid date string: ${s}`);
  }
  return d;
}

function addDays(d: Date, deltaDays: number) {
  const next = new Date(d);
  next.setDate(next.getDate() + deltaDays);
  return next;
}

export async function GET(
  _: Request,
  ctx: { params: Promise<{ roundId: string }> }
) {
  const { roundId } = await ctx.params;

  if (!roundId) {
    return NextResponse.json({ error: "roundId required" }, { status: 400 });
  }

  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      person: true,
      roundCategories: {
        orderBy: { sortOrder: "asc" },
        select: {
          categoryId: true,
          displayName: true,
          category: { select: { allowDaysOffPerWeek: true } },
        },
      },
      entries: true,
    },
  });

  if (!round) return NextResponse.json({ error: "Round not found" }, { status: 404 });

const normalized = {
  ...round,
  startDate: ymd(round.startDate),
  roundCategories: round.roundCategories.map((c) => ({
    categoryId: c.categoryId,
    displayName: c.displayName,
    allowDaysOffPerWeek: c.category?.allowDaysOffPerWeek ?? 0,
  })),
  entries: round.entries.map((e) => ({
    ...e,
    date: ymd(e.date),
  })),
};


  return NextResponse.json(normalized);
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ roundId: string }> }
) {
  const { roundId } = await ctx.params;

  if (!roundId) {
    return NextResponse.json({ error: "roundId is required" }, { status: 400 });
  }

  const exists = await prisma.round.findUnique({
    where: { id: roundId },
    select: { id: true },
  });

  if (!exists) {
    return NextResponse.json({ error: "Round not found" }, { status: 404 });
  }

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.entry.deleteMany({ where: { roundId } });
    await tx.roundCategory.deleteMany({ where: { roundId } });
    await tx.round.delete({ where: { id: roundId } });
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ roundId: string }> }
) {
  const { roundId } = await ctx.params;

  if (!roundId) {
    return NextResponse.json({ error: "roundId is required" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const startDateInput = body?.startDate;

  if (!startDateInput || typeof startDateInput !== "string") {
    return NextResponse.json({ error: "startDate is required" }, { status: 400 });
  }

  let nextStart: Date;
  try {
    nextStart = parseLocalDay(startDateInput);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message ?? "Invalid startDate" },
      { status: 400 }
    );
  }

  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: { entries: true },
  });

  if (!round) {
    return NextResponse.json({ error: "Round not found" }, { status: 404 });
  }

  const currentStart = parseLocalDay(ymd(round.startDate));
  const deltaDays = Math.round(
    (nextStart.getTime() - currentStart.getTime()) / (24 * 60 * 60 * 1000)
  );

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.round.update({
      where: { id: roundId },
      data: { startDate: nextStart },
    });

    if (deltaDays === 0 || round.entries.length === 0) return;

    const entriesByCategory = new Map<string, typeof round.entries>();
    for (const entry of round.entries) {
      const list = entriesByCategory.get(entry.categoryId) ?? [];
      list.push(entry);
      entriesByCategory.set(entry.categoryId, list);
    }

    const sortDir = deltaDays >= 0 ? -1 : 1;
    for (const list of entriesByCategory.values()) {
      list.sort((a, b) => sortDir * (a.date.getTime() - b.date.getTime()));
      for (const entry of list) {
        const shifted = addDays(entry.date, deltaDays);
        await tx.entry.update({
          where: { id: entry.id },
          data: { date: shifted },
        });
      }
    }
  });

  return NextResponse.json(
    { ok: true, startDate: ymd(nextStart), shiftedDays: deltaDays },
    { status: 200 }
  );
}
