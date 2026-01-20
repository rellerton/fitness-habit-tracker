import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

  const roundCount = await prisma.round.count({ where: { personId } });

  if (roundCount === 0) {
    return NextResponse.json({ round: null, roundNumber: 0 });
  }

  const latest = await prisma.round.findFirst({
    where: { personId },
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
    },
  });

  if (!latest) {
    return NextResponse.json({ round: null, roundNumber: 0 });
  }

  const normalized = {
    ...latest,
    startDate: ymd(latest.startDate),
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
  };

  return NextResponse.json({ round: normalized, roundNumber: roundCount });
}
