import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

function parseApplyToExisting(value: unknown) {
  if (value === true) return true;
  if (value === "true") return true;
  if (value === 1) return true;
  if (value === "1") return true;
  return false;
}

function parseOptionalBoolean(value: unknown) {
  if (value === undefined) return { provided: false as const, value: undefined };
  if (value === true || value === "true" || value === 1 || value === "1") {
    return { provided: true as const, value: true };
  }
  if (value === false || value === "false" || value === 0 || value === "0") {
    return { provided: true as const, value: false };
  }
  return { provided: true as const, error: "must be true or false" };
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

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ categoryId: string }> }
) {
  const { categoryId } = await ctx.params;

  if (!categoryId) {
    return NextResponse.json({ error: "categoryId is required" }, { status: 400 });
  }

  const exists = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true, active: true, trackerTypeId: true },
  });

  if (!exists || !exists.active) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const removeFromActiveRounds = parseApplyToExisting(body?.removeFromActiveRounds);

  // Soft delete so existing rounds/entries remain intact (unless opted out below).
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.category.update({
      where: { id: categoryId },
      data: { active: false },
    });

    if (removeFromActiveRounds) {
      const latestRoundIds = await getLatestRoundIdsByTrackerType(tx, exists.trackerTypeId);
      if (latestRoundIds.length > 0) {
        await tx.entry.deleteMany({
          where: { categoryId, roundId: { in: latestRoundIds } },
        });
        await tx.roundCategory.deleteMany({
          where: { categoryId, roundId: { in: latestRoundIds } },
        });
      }
    }
  });

  return NextResponse.json({ ok: true });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ categoryId: string }> }
) {
  const { categoryId } = await ctx.params;

  if (!categoryId) {
    return NextResponse.json({ error: "categoryId is required" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const name = (body?.name as string | undefined)?.trim();
  const allowDaysOffInput = body?.allowDaysOffPerWeek as number | string | undefined;
  const allowTreatParsed = parseOptionalBoolean(body?.allowTreat);
  const allowSickParsed = parseOptionalBoolean(body?.allowSick);
  const applyToExisting = parseApplyToExisting(body?.applyToExisting);
  let allowDaysOffPerWeek: number | undefined;
  let allowTreat: boolean | undefined;
  let allowSick: boolean | undefined;

  if (!name) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

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

  if ("error" in allowTreatParsed) {
    return NextResponse.json({ error: "allowTreat must be true or false." }, { status: 400 });
  }
  if ("error" in allowSickParsed) {
    return NextResponse.json({ error: "allowSick must be true or false." }, { status: 400 });
  }
  if (allowTreatParsed.provided) {
    allowTreat = allowTreatParsed.value;
  }
  if (allowSickParsed.provided) {
    allowSick = allowSickParsed.value;
  }

  const exists = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true, active: true, trackerTypeId: true },
  });

  if (!exists || !exists.active) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.category.update({
        where: { id: categoryId },
        data: {
          name,
          ...(allowDaysOffPerWeek !== undefined ? { allowDaysOffPerWeek } : {}),
          ...(allowTreat !== undefined ? { allowTreat } : {}),
          ...(allowSick !== undefined ? { allowSick } : {}),
        },
        select: {
          id: true,
          name: true,
          sortOrder: true,
          allowDaysOffPerWeek: true,
          allowTreat: true,
          allowSick: true,
        },
      });

      if (applyToExisting) {
        const latestRoundIds = await getLatestRoundIdsByTrackerType(tx, exists.trackerTypeId);
        if (latestRoundIds.length > 0) {
          await tx.roundCategory.updateMany({
            where: { categoryId, roundId: { in: latestRoundIds } },
            data: { displayName: name },
          });
        }
      }

      return next;
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Category name already exists." }, { status: 409 });
    }
    throw error;
  }
}
