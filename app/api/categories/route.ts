import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

const MAX_ACTIVE_CATEGORIES = 5;

export async function GET() {
  const cats = await prisma.category.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, sortOrder: true, allowDaysOffPerWeek: true },
  });

  return NextResponse.json(cats);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const name = (body?.name as string | undefined)?.trim();
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

  const activeCount = await prisma.category.count({ where: { active: true } });
  const existing = await prisma.category.findUnique({ where: { name } });
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
    where: { active: true },
  });
  const nextSort = (max._max.sortOrder ?? 0) + 1;

  if (existing && !existing.active) {
    const reactivated = await prisma.category.update({
      where: { id: existing.id },
      data: { active: true, sortOrder: nextSort, allowDaysOffPerWeek },
      select: { id: true, name: true, sortOrder: true, allowDaysOffPerWeek: true },
    });
    return NextResponse.json(reactivated, { status: 200 });
  }

  try {
    const created = await prisma.category.create({
      data: { name, sortOrder: nextSort, allowDaysOffPerWeek },
      select: { id: true, name: true, sortOrder: true, allowDaysOffPerWeek: true },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Category name already exists." }, { status: 409 });
    }
    throw error;
  }
}
