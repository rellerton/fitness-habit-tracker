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

async function getLatestRoundIds(tx: Prisma.TransactionClient) {
  const rounds = await tx.round.findMany({
    orderBy: [{ personId: "asc" }, { createdAt: "desc" }],
    select: { id: true, personId: true },
  });

  const latestRoundIds: string[] = [];
  const seen = new Set<string>();
  for (const round of rounds) {
    if (seen.has(round.personId)) continue;
    seen.add(round.personId);
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
    select: { id: true, active: true },
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
      const latestRoundIds = await getLatestRoundIds(tx);
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
  const applyToExisting = parseApplyToExisting(body?.applyToExisting);
  let allowDaysOffPerWeek: number | undefined;

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

  const exists = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true, active: true },
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
        },
        select: { id: true, name: true, sortOrder: true, allowDaysOffPerWeek: true },
      });

      if (applyToExisting) {
        const latestRoundIds = await getLatestRoundIds(tx);
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
