import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const personId = searchParams.get("personId")?.trim();
  const includeInactive = searchParams.get("includeInactive") === "true";

  if (!personId) {
    return NextResponse.json({ error: "personId is required" }, { status: 400 });
  }

  const trackers = await prisma.tracker.findMany({
    where: {
      personId,
      ...(includeInactive ? {} : { active: true }),
    },
    orderBy: [{ createdAt: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      active: true,
      trackerTypeId: true,
      trackerType: {
        select: { id: true, name: true, active: true },
      },
      rounds: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
      _count: {
        select: { rounds: true },
      },
    },
  });

  return NextResponse.json(
    trackers.map((tracker) => ({
      id: tracker.id,
      name: tracker.name,
      active: tracker.active,
      trackerTypeId: tracker.trackerTypeId,
      trackerType: tracker.trackerType,
      roundsCount: tracker._count.rounds,
      latestRoundCreatedAt:
        tracker.rounds.length > 0 ? tracker.rounds[0].createdAt.toISOString() : null,
    }))
  );
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const personId = (body?.personId as string | undefined)?.trim();
  const trackerTypeId = (body?.trackerTypeId as string | undefined)?.trim();
  const nameInput = (body?.name as string | undefined)?.trim();

  if (!personId || !trackerTypeId) {
    return NextResponse.json(
      { error: "personId and trackerTypeId are required" },
      { status: 400 }
    );
  }

  const [person, trackerType] = await Promise.all([
    prisma.person.findUnique({ where: { id: personId }, select: { id: true } }),
    prisma.trackerType.findUnique({
      where: { id: trackerTypeId },
      select: { id: true, name: true, active: true },
    }),
  ]);

  if (!person) {
    return NextResponse.json({ error: "Person not found" }, { status: 404 });
  }
  if (!trackerType || !trackerType.active) {
    return NextResponse.json({ error: "Tracker type not found" }, { status: 404 });
  }

  const sameTypeCount = await prisma.tracker.count({
    where: { personId, trackerTypeId },
  });

  const defaultName =
    sameTypeCount === 0 ? trackerType.name : `${trackerType.name} ${sameTypeCount + 1}`;
  const name = nameInput || defaultName;

  const tracker = await prisma.tracker.create({
    data: {
      personId,
      trackerTypeId,
      name,
    },
    select: {
      id: true,
      name: true,
      active: true,
      trackerTypeId: true,
      trackerType: {
        select: { id: true, name: true, active: true },
      },
    },
  });

  return NextResponse.json(tracker, { status: 201 });
}
