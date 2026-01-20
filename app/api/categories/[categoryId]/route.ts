import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function DELETE(
  _req: Request,
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

  // Soft delete so existing rounds/entries remain intact.
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.category.update({
      where: { id: categoryId },
      data: { active: false },
    });
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
    const updated = await prisma.category.update({
      where: { id: categoryId },
      data: {
        name,
        ...(allowDaysOffPerWeek !== undefined ? { allowDaysOffPerWeek } : {}),
      },
      select: { id: true, name: true, sortOrder: true, allowDaysOffPerWeek: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Category name already exists." }, { status: 409 });
    }
    throw error;
  }
}
