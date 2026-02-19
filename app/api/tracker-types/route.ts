import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const includeInactive = searchParams.get("includeInactive") === "true";
  const includeStats = searchParams.get("includeStats") === "true";

  if (!includeStats) {
    const trackerTypes = await prisma.trackerType.findMany({
      where: includeInactive ? undefined : { active: true },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, active: true },
    });

    return NextResponse.json(trackerTypes);
  }

  const trackerTypes = await prisma.trackerType.findMany({
    where: includeInactive ? undefined : { active: true },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      active: true,
      createdAt: true,
      _count: { select: { categories: true, trackers: true } },
      trackers: {
        select: {
          _count: { select: { rounds: true } },
        },
      },
    },
  });

  return NextResponse.json(
    trackerTypes.map((tt) => ({
      id: tt.id,
      name: tt.name,
      active: tt.active,
      createdAt: tt.createdAt.toISOString(),
      categoriesCount: tt._count.categories,
      trackersCount: tt._count.trackers,
      roundsCount: tt.trackers.reduce((sum, tracker) => sum + tracker._count.rounds, 0),
    }))
  );
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const name = (body?.name as string | undefined)?.trim();

  if (!name) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  const existing = await prisma.trackerType.findUnique({
    where: { name },
    select: { id: true, active: true },
  });

  if (existing?.active) {
    return NextResponse.json({ error: "Tracker type already exists." }, { status: 409 });
  }

  try {
    if (existing && !existing.active) {
      const reactivated = await prisma.trackerType.update({
        where: { id: existing.id },
        data: { active: true },
        select: { id: true, name: true, active: true },
      });
      return NextResponse.json(reactivated);
    }

    const created = await prisma.trackerType.create({
      data: { name },
      select: { id: true, name: true, active: true },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Tracker type already exists." }, { status: 409 });
    }
    throw error;
  }
}
