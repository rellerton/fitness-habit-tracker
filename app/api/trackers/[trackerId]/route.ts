import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ trackerId: string }> }
) {
  const { trackerId } = await ctx.params;
  if (!trackerId) {
    return NextResponse.json({ error: "trackerId is required" }, { status: 400 });
  }

  const tracker = await prisma.tracker.findUnique({
    where: { id: trackerId },
    select: { id: true, personId: true, active: true, _count: { select: { rounds: true } } },
  });

  if (!tracker || !tracker.active) {
    return NextResponse.json({ error: "Tracker not found" }, { status: 404 });
  }

  const activeCount = await prisma.tracker.count({
    where: { personId: tracker.personId, active: true },
  });

  if (activeCount <= 1) {
    return NextResponse.json(
      { error: "Cannot remove the last active tracker for a person." },
      { status: 400 }
    );
  }

  if (tracker._count.rounds === 0) {
    await prisma.tracker.delete({ where: { id: trackerId } });
  } else {
    await prisma.tracker.update({
      where: { id: trackerId },
      data: { active: false },
    });
  }

  return NextResponse.json({ ok: true });
}
