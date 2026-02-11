import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const roundId = body?.roundId as string | undefined;
  const dateStr = body?.date as string | undefined;
  const weightInput = body?.weight as number | string | undefined;

  if (!roundId || !dateStr) {
    return NextResponse.json(
      { error: "roundId and date are required" },
      { status: 400 }
    );
  }

  let weight: number | null = null;
  if (weightInput !== undefined && weightInput !== null && weightInput !== "") {
    const parsed = typeof weightInput === "string" ? Number(weightInput) : weightInput;
    if (Number.isFinite(parsed)) {
      weight = parsed;
    }
  }

  if (weight === null) {
    return NextResponse.json({ error: "weight is required" }, { status: 400 });
  }
  if (weight <= 0) {
    return NextResponse.json({ error: "weight must be > 0" }, { status: 400 });
  }

  let date: Date;
  try {
    date = parseLocalDay(dateStr);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message ?? "Invalid date" },
      { status: 400 }
    );
  }

  const round = await prisma.round.findUnique({
    where: { id: roundId },
    select: { id: true, startDate: true, lengthWeeks: true },
  });

  if (!round) {
    return NextResponse.json({ error: "Round not found" }, { status: 404 });
  }

  const startLocal = parseLocalDay(ymd(round.startDate));
  const diffDays = Math.floor(
    (date.getTime() - startLocal.getTime()) / (24 * 60 * 60 * 1000)
  );

  if (diffDays < 0 || diffDays >= round.lengthWeeks * 7) {
    return NextResponse.json(
      { error: "Date is outside this round" },
      { status: 400 }
    );
  }

  const weekIndex = Math.floor(diffDays / 7);

  const entry = await prisma.weightEntry.upsert({
    where: { roundId_weekIndex: { roundId, weekIndex } },
    update: { weight, date },
    create: { roundId, weekIndex, weight, date },
  });

  return NextResponse.json({
    id: entry.id,
    roundId: entry.roundId,
    weekIndex: entry.weekIndex,
    weight: entry.weight,
    date: ymd(entry.date),
  });
}
