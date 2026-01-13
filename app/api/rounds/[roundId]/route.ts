import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

function ymd(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
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
      roundCategories: { orderBy: { sortOrder: "asc" } },
      entries: true,
    },
  });

  if (!round) return NextResponse.json({ error: "Round not found" }, { status: 404 });

const normalized = {
  ...round,
  startDate: ymd(round.startDate),
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
