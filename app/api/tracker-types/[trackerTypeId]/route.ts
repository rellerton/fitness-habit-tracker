import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

function parseBooleanFlag(value: unknown) {
  if (value === true || value === "true" || value === 1 || value === "1") return true;
  return false;
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ trackerTypeId: string }> }
) {
  const { trackerTypeId } = await ctx.params;
  if (!trackerTypeId) {
    return NextResponse.json({ error: "trackerTypeId is required" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const name = (body?.name as string | undefined)?.trim();
  if (!name) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  const exists = await prisma.trackerType.findUnique({
    where: { id: trackerTypeId },
    select: { id: true, active: true },
  });
  if (!exists || !exists.active) {
    return NextResponse.json({ error: "Tracker type not found" }, { status: 404 });
  }

  try {
    const updated = await prisma.trackerType.update({
      where: { id: trackerTypeId },
      data: { name },
      select: { id: true, name: true, active: true },
    });
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Tracker type name already exists." }, { status: 409 });
    }
    throw error;
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ trackerTypeId: string }> }
) {
  const { trackerTypeId } = await ctx.params;
  if (!trackerTypeId) {
    return NextResponse.json({ error: "trackerTypeId is required" }, { status: 400 });
  }

  const exists = await prisma.trackerType.findUnique({
    where: { id: trackerTypeId },
    select: { id: true, active: true },
  });
  if (!exists || !exists.active) {
    return NextResponse.json({ error: "Tracker type not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const deactivateTrackers = parseBooleanFlag(body?.deactivateTrackers);

  await prisma.$transaction(async (tx) => {
    await tx.trackerType.update({
      where: { id: trackerTypeId },
      data: { active: false },
    });

    await tx.category.updateMany({
      where: { trackerTypeId },
      data: { active: false },
    });

    if (deactivateTrackers) {
      await tx.tracker.updateMany({
        where: { trackerTypeId },
        data: { active: false },
      });
    }
  });

  return NextResponse.json({ ok: true });
}
