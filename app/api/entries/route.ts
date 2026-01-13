import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const cycle = ["EMPTY", "HALF", "DONE", "OFF", "TREAT", "SICK"] as const;
type EntryStatus = (typeof cycle)[number];

function asEntryStatus(value: unknown): EntryStatus {
  return cycle.includes(value as EntryStatus) ? (value as EntryStatus) : "EMPTY";
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);

  const roundId = body?.roundId as string | undefined;
  const categoryId = body?.categoryId as string | undefined;
  const dateStr = body?.date as string | undefined;
  const mode = body?.mode as "cycle" | "set" | undefined;
  const status = body?.status as EntryStatus | undefined;

  if (!roundId || !categoryId || !dateStr) {
    return NextResponse.json(
      { error: "roundId, categoryId, date required" },
      { status: 400 }
    );
  }

  const date = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const existing = await prisma.entry.findUnique({
    where: { roundId_categoryId_date: { roundId, categoryId, date } },
    // (optional) select only what we need; sometimes helps TS inference
    select: { status: true },
  });

  let nextStatus: EntryStatus;

  if (mode === "set") {
    if (!status || !cycle.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    nextStatus = status;
  } else {
    const current = asEntryStatus(existing?.status);
    const idx = cycle.indexOf(current);
    nextStatus = cycle[(idx + 1) % cycle.length];
  }

  const entry = await prisma.entry.upsert({
    where: { roundId_categoryId_date: { roundId, categoryId, date } },
    update: { status: nextStatus },
    create: { roundId, categoryId, date, status: nextStatus },
  });

  return NextResponse.json(entry);
}
