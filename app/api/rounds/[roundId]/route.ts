import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import {
  addLocalDays,
  differenceInCalendarDays,
  formatYmd,
  parseLocalYmd,
} from "@/lib/dates";
import { positiveNumber } from "@/lib/validation";

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
          category: { select: { allowDaysOffPerWeek: true, allowTreat: true, allowSick: true } },
        },
      },
      entries: true,
    },
  });

  if (!round) return NextResponse.json({ error: "Round not found" }, { status: 404 });

const normalized = {
  ...round,
  startDate: formatYmd(round.startDate),
  roundCategories: round.roundCategories.map((c) => ({
    categoryId: c.categoryId,
    displayName: c.displayName,
    allowDaysOffPerWeek: c.category?.allowDaysOffPerWeek ?? 0,
    allowTreat: c.category?.allowTreat ?? true,
    allowSick: c.category?.allowSick ?? true,
  })),
  entries: round.entries.map((e) => ({
    ...e,
    date: formatYmd(e.date),
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
  const goalWeightInput = body?.goalWeight as number | string | undefined;

  if (
    (startDateInput === undefined || startDateInput === null) &&
    (goalWeightInput === undefined || goalWeightInput === null || goalWeightInput === "")
  ) {
    return NextResponse.json(
      { error: "startDate or goalWeight is required" },
      { status: 400 }
    );
  }

  let nextStart: Date | null = null;
  if (startDateInput !== undefined && startDateInput !== null) {
    if (typeof startDateInput !== "string") {
      return NextResponse.json({ error: "startDate must be a string" }, { status: 400 });
    }
    nextStart = parseLocalYmd(startDateInput);
    if (!nextStart) {
      return NextResponse.json(
        { error: "startDate must be a valid calendar date in YYYY-MM-DD format" },
        { status: 400 }
      );
    }
  }

  let goalWeight: number | null | undefined;
  if (goalWeightInput !== undefined && goalWeightInput !== null && goalWeightInput !== "") {
    const parsed = positiveNumber(goalWeightInput, "goalWeight");
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    goalWeight = parsed.value;
  } else if (goalWeightInput === null || goalWeightInput === "") {
    goalWeight = null;
  }

  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: { entries: true, weightEntries: true },
  });

  if (!round) {
    return NextResponse.json({ error: "Round not found" }, { status: 404 });
  }

  const deltaDays =
    nextStart === null ? 0 : differenceInCalendarDays(nextStart, round.startDate);

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.round.update({
      where: { id: roundId },
      data: {
        ...(nextStart ? { startDate: nextStart } : {}),
        ...(goalWeight !== undefined ? { goalWeight } : {}),
      },
    });

    if (deltaDays === 0) return;

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
        const shifted = addLocalDays(entry.date, deltaDays);
        await tx.entry.update({
          where: { id: entry.id },
          data: { date: shifted },
        });
      }
    }

    for (const weightEntry of round.weightEntries) {
      await tx.weightEntry.update({
        where: { id: weightEntry.id },
        data: { date: addLocalDays(weightEntry.date, deltaDays) },
      });
    }
  });

  return NextResponse.json(
    {
      ok: true,
      startDate: nextStart ? formatYmd(nextStart) : formatYmd(round.startDate),
      shiftedDays: deltaDays,
      shiftedEntries: deltaDays === 0 ? 0 : round.entries.length,
      shiftedWeightEntries: deltaDays === 0 ? 0 : round.weightEntries.length,
    },
    { status: 200 }
  );
}
