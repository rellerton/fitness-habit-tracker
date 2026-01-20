import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

type ReorderBody = {
  categoryId?: string;
  direction?: "up" | "down";
};

export async function PATCH(req: Request) {
  const body = (await req.json().catch(() => null)) as ReorderBody | null;
  const categoryId = body?.categoryId;
  const direction = body?.direction;

  if (!categoryId || (direction !== "up" && direction !== "down")) {
    return NextResponse.json({ error: "categoryId and direction required" }, { status: 400 });
  }

  const current = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true, sortOrder: true, active: true },
  });

  if (!current || !current.active) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  const neighbor = await prisma.category.findFirst({
    where:
      direction === "up"
        ? { sortOrder: { lt: current.sortOrder }, active: true }
        : { sortOrder: { gt: current.sortOrder }, active: true },
    orderBy: { sortOrder: direction === "up" ? "desc" : "asc" },
    select: { id: true, sortOrder: true },
  });

  // Already at the edge
  if (!neighbor) {
    return NextResponse.json({ ok: true });
  }

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.category.update({
      where: { id: current.id },
      data: { sortOrder: neighbor.sortOrder },
    });

    await tx.category.update({
      where: { id: neighbor.id },
      data: { sortOrder: current.sortOrder },
    });
  });

  return NextResponse.json({ ok: true });
}
