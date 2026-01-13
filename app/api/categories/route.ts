import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const cats = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, sortOrder: true },
  });

  return NextResponse.json(cats);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const name = (body?.name as string | undefined)?.trim();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  // Put new category at bottom
  const max = await prisma.category.aggregate({ _max: { sortOrder: true } });
  const nextSort = (max._max.sortOrder ?? 0) + 1;

  const created = await prisma.category.create({
    data: { name, sortOrder: nextSort },
    select: { id: true, name: true, sortOrder: true },
  });

  return NextResponse.json(created, { status: 201 });
}
