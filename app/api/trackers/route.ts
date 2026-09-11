import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  MAX_NAME_LENGTH,
  requiredName,
  requiredString,
} from "@/lib/validation";

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
  const personIdResult = requiredString(body?.personId, "personId");
  const trackerTypeIdResult = requiredString(body?.trackerTypeId, "trackerTypeId");
  const nameResult =
    body?.name === undefined || body?.name === null || body?.name === ""
      ? null
      : requiredName(body.name, "name");

  if ("error" in personIdResult) {
    return NextResponse.json({ error: personIdResult.error }, { status: 400 });
  }
  if ("error" in trackerTypeIdResult) {
    return NextResponse.json({ error: trackerTypeIdResult.error }, { status: 400 });
  }
  if (nameResult && "error" in nameResult) {
    return NextResponse.json({ error: nameResult.error }, { status: 400 });
  }
  const personId = personIdResult.value;
  const trackerTypeId = trackerTypeIdResult.value;

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

  const suffix = sameTypeCount === 0 ? "" : ` ${sameTypeCount + 1}`;
  const defaultName = `${trackerType.name.slice(0, MAX_NAME_LENGTH - suffix.length)}${suffix}`;
  const name = nameResult?.value ?? defaultName;

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
