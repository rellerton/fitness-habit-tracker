import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

function parseLocalYmdToDate(ymd: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;

  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);

  const d = new Date(year, month - 1, day, 0, 0, 0, 0);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const personId = body?.personId as string | undefined;
  const startDateStr = body?.startDate as string | undefined;

  if (!personId) {
    return NextResponse.json({ error: "personId required" }, { status: 400 });
  }

  const settings = await prisma.appSettings.findUnique({ where: { id: "singleton" } });
  const lengthWeeks = settings?.roundLengthWeeks ?? 8;

  let startDate: Date;
  if (startDateStr) {
    const parsed = parseLocalYmdToDate(startDateStr);
    if (!parsed) {
      return NextResponse.json(
        { error: "Invalid startDate (expected YYYY-MM-DD)" },
        { status: 400 }
      );
    }
    startDate = parsed;
  } else {
    const now = new Date();
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  }

  type CategoryRow = { id: string; name: string; sortOrder: number };

  const categories = (await prisma.category.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, sortOrder: true },
  })) as CategoryRow[];

  const categoryData: CategoryRow[] = categories;



  if (categories.length === 0) {
    return NextResponse.json(
      { error: "No active categories. Add/enable categories first." },
      { status: 400 }
    );
  }

  const created = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {

    return tx.round.create({
      data: {
        personId,
        startDate,
        lengthWeeks,
        roundCategories: {
          createMany: {
            data: categoryData.map((c) => ({
              categoryId: c.id,
              sortOrder: c.sortOrder,
              displayName: c.name,
            })),
          },
        },
      },
      select: { id: true },
    });
  });

  return NextResponse.json(created, { status: 201 });
}
