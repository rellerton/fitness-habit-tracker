import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { differenceInCalendarDays, parseLocalYmd } from "@/lib/dates";
import { requiredString } from "@/lib/validation";

const baseCycle = ["EMPTY", "HALF", "DONE", "OFF"] as const;
const optionalStatuses = ["TREAT", "SICK"] as const;
const allStatuses = [...baseCycle, ...optionalStatuses] as const;
type EntryStatus = (typeof allStatuses)[number];

function asEntryStatus(value: unknown): EntryStatus {
  return allStatuses.includes(value as EntryStatus) ? (value as EntryStatus) : "EMPTY";
}

function cycleForCategory(allowTreat: boolean, allowSick: boolean): EntryStatus[] {
  return [
    ...baseCycle,
    ...(allowTreat ? (["TREAT"] as const) : []),
    ...(allowSick ? (["SICK"] as const) : []),
  ];
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);

  const roundIdResult = requiredString(body?.roundId, "roundId");
  const categoryIdResult = requiredString(body?.categoryId, "categoryId");
  const dateStr = body?.date;
  const mode = body?.mode as "cycle" | "set" | undefined;
  const status = body?.status as EntryStatus | undefined;

  if ("error" in roundIdResult) {
    return NextResponse.json({ error: roundIdResult.error }, { status: 400 });
  }
  if ("error" in categoryIdResult) {
    return NextResponse.json({ error: categoryIdResult.error }, { status: 400 });
  }
  const roundId = roundIdResult.value;
  const categoryId = categoryIdResult.value;

  const date = parseLocalYmd(dateStr);
  if (!date) {
    return NextResponse.json(
      { error: "date must be a valid calendar date in YYYY-MM-DD format" },
      { status: 400 }
    );
  }

  if (mode !== undefined && mode !== "cycle" && mode !== "set") {
    return NextResponse.json({ error: "mode must be cycle or set" }, { status: 400 });
  }

  const round = await prisma.round.findUnique({
    where: { id: roundId },
    select: {
      startDate: true,
      lengthWeeks: true,
      roundCategories: {
        where: { categoryId },
        select: {
          category: { select: { allowTreat: true, allowSick: true } },
        },
      },
    },
  });
  if (!round) {
    return NextResponse.json({ error: "Round not found" }, { status: 404 });
  }
  if (round.roundCategories.length === 0) {
    return NextResponse.json(
      { error: "Category is not part of this round" },
      { status: 400 }
    );
  }

  const offset = differenceInCalendarDays(date, round.startDate);
  if (offset < 0 || offset >= round.lengthWeeks * 7) {
    return NextResponse.json({ error: "Date is outside this round" }, { status: 400 });
  }

  const existing = await prisma.entry.findUnique({
    where: { roundId_categoryId_date: { roundId, categoryId, date } },
    select: { status: true },
  });
  const category = round.roundCategories[0].category;
  const cycle = cycleForCategory(category.allowTreat, category.allowSick);

  let nextStatus: EntryStatus;

  if (mode === "set") {
    if (!status || !cycle.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    nextStatus = status;
  } else {
    const current = asEntryStatus(existing?.status);
    const idx = cycle.indexOf(current);
    nextStatus = idx >= 0 ? cycle[(idx + 1) % cycle.length] : cycle[0];
  }

  const entry = await prisma.entry.upsert({
    where: { roundId_categoryId_date: { roundId, categoryId, date } },
    update: { status: nextStatus },
    create: { roundId, categoryId, date, status: nextStatus },
  });

  return NextResponse.json(entry);
}
