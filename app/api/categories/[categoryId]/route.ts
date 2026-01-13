import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

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
    select: { id: true },
  });

  if (!exists) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  // NOTE: This only deletes the Category definition.
  // Existing rounds keep their snapshot categories (RoundCategory.displayName, etc.)
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.category.delete({ where: { id: categoryId } });
  });

  return NextResponse.json({ ok: true });
}
