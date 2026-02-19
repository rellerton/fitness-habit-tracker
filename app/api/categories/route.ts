import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

const MAX_ACTIVE_CATEGORIES = 5;

function parseApplyToExisting(value: unknown) {
  if (value === true) return true;
  if (value === "true") return true;
  if (value === 1) return true;
  if (value === "1") return true;
  return false;
}

async function getLatestRoundIdsByTrackerType(
  tx: Prisma.TransactionClient,
  trackerTypeId: string
) {
  const rounds = await tx.round.findMany({
    where: { tracker: { trackerTypeId, active: true } },
    orderBy: [{ trackerId: "asc" }, { createdAt: "desc" }],
    select: { id: true, trackerId: true },
  });

  const latestRoundIds: string[] = [];
  const seen = new Set<string>();
  for (const round of rounds) {
    if (seen.has(round.trackerId)) continue;
    seen.add(round.trackerId);
    latestRoundIds.push(round.id);
  }

  return latestRoundIds;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const trackerTypeId = searchParams.get("trackerTypeId")?.trim();
  if (!trackerTypeId) {
    return NextResponse.json({ error: "trackerTypeId required" }, { status: 400 });
  }

  const cats = await prisma.category.findMany({
    where: { active: true, trackerTypeId },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, sortOrder: true, allowDaysOffPerWeek: true },
  });

  return NextResponse.json(cats);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const name = (body?.name as string | undefined)?.trim();
  const trackerTypeId = (body?.trackerTypeId as string | undefined)?.trim();

  if (!trackerTypeId) {
    return NextResponse.json({ error: "trackerTypeId required" }, { status: 400 });
  }
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const allowDaysOffInput = body?.allowDaysOffPerWeek as number | string | undefined;
  let allowDaysOffPerWeek = 0;
  if (allowDaysOffInput !== undefined) {
    const parsed =
      typeof allowDaysOffInput === "string" ? Number(allowDaysOffInput) : allowDaysOffInput;
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 5) {
      return NextResponse.json(
        { error: "allowDaysOffPerWeek must be 0-5." },
        { status: 400 }
      );
    }
    allowDaysOffPerWeek = parsed;
  }

  const applyToExisting = parseApplyToExisting(body?.applyToExisting);

  const trackerType = await prisma.trackerType.findUnique({
    where: { id: trackerTypeId },
    select: { id: true, active: true },
  });

  if (!trackerType || !trackerType.active) {
    return NextResponse.json({ error: "Tracker type not found" }, { status: 404 });
  }

  const activeCount = await prisma.category.count({ where: { active: true, trackerTypeId } });
  const existing = await prisma.category.findUnique({
    where: { trackerTypeId_name: { trackerTypeId, name } },
  });
  if (existing?.active) {
    return NextResponse.json({ error: "Category name already exists." }, { status: 409 });
  }
  if (activeCount >= MAX_ACTIVE_CATEGORIES) {
    return NextResponse.json(
      { error: `Max ${MAX_ACTIVE_CATEGORIES} active categories reached.` },
      { status: 400 }
    );
  }

  // Put new category at bottom of active list
  const max = await prisma.category.aggregate({
    _max: { sortOrder: true },
    where: { active: true, trackerTypeId },
  });
  const nextSort = (max._max.sortOrder ?? 0) + 1;

  try {
    const responseStatus = existing && !existing.active ? 200 : 201;
    const category = await prisma.$transaction(async (tx) => {
      let created: { id: string; name: string; sortOrder: number; allowDaysOffPerWeek: number };
      if (existing && !existing.active) {
        created = await tx.category.update({
          where: { id: existing.id },
          data: { active: true, sortOrder: nextSort, allowDaysOffPerWeek },
          select: { id: true, name: true, sortOrder: true, allowDaysOffPerWeek: true },
        });
      } else {
        created = await tx.category.create({
          data: { trackerTypeId, name, sortOrder: nextSort, allowDaysOffPerWeek },
          select: { id: true, name: true, sortOrder: true, allowDaysOffPerWeek: true },
        });
      }

      if (applyToExisting) {
        const latestRoundIds = await getLatestRoundIdsByTrackerType(tx, trackerTypeId);
        if (latestRoundIds.length > 0) {
          const roundsMissing = await tx.round.findMany({
            where: {
              id: { in: latestRoundIds },
              roundCategories: { none: { categoryId: created.id } },
            },
            select: { id: true },
          });

          if (roundsMissing.length > 0) {
            await tx.roundCategory.createMany({
              data: roundsMissing.map((round) => ({
                roundId: round.id,
                categoryId: created.id,
                sortOrder: created.sortOrder,
                displayName: created.name,
              })),
            });
          }
        }
      }

      return created;
    });

    return NextResponse.json(category, { status: responseStatus });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Category name already exists." }, { status: 409 });
    }
    throw error;
  }
}
