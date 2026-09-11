import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { differenceInCalendarDays, formatYmd, parseLocalYmd } from "@/lib/dates";
import { positiveNumber, requiredString } from "@/lib/validation";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const roundIdResult = requiredString(body?.roundId, "roundId");

  if ("error" in roundIdResult) {
    return NextResponse.json({ error: roundIdResult.error }, { status: 400 });
  }
  const roundId = roundIdResult.value;

  const weightResult = positiveNumber(body?.weight, "weight");
  if ("error" in weightResult) {
    return NextResponse.json({ error: weightResult.error }, { status: 400 });
  }
  const weight = weightResult.value;

  const date = parseLocalYmd(body?.date);
  if (!date) {
    return NextResponse.json(
      { error: "date must be a valid calendar date in YYYY-MM-DD format" },
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

  const diffDays = differenceInCalendarDays(date, round.startDate);

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
    date: formatYmd(entry.date),
  });
}
