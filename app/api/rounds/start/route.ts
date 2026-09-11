import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { parseLocalYmd } from "@/lib/dates";
import { positiveNumber, requiredString } from "@/lib/validation";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const personIdResult = requiredString(body?.personId, "personId");
  const trackerIdResult =
    body?.trackerId === undefined || body?.trackerId === null || body?.trackerId === ""
      ? null
      : requiredString(body.trackerId, "trackerId");
  const startDateStr = body?.startDate;
  const lengthWeeksInput = body?.lengthWeeks as number | string | undefined;
  const goalWeightInput = body?.goalWeight as number | string | undefined;

  if ("error" in personIdResult) {
    return NextResponse.json({ error: personIdResult.error }, { status: 400 });
  }
  if (trackerIdResult && "error" in trackerIdResult) {
    return NextResponse.json({ error: trackerIdResult.error }, { status: 400 });
  }
  const personId = personIdResult.value;
  const trackerIdInput = trackerIdResult?.value;

  const tracker = trackerIdInput
    ? await prisma.tracker.findUnique({
        where: { id: trackerIdInput },
        select: { id: true, personId: true, active: true, trackerTypeId: true },
      })
    : await prisma.tracker.findFirst({
        where: { personId, active: true },
        orderBy: { createdAt: "asc" },
        select: { id: true, personId: true, active: true, trackerTypeId: true },
      });

  if (!tracker || tracker.personId !== personId || !tracker.active) {
    return NextResponse.json(
      { error: "Active tracker not found for this person." },
      { status: 404 }
    );
  }

  let lengthWeeks = 8;
  if (lengthWeeksInput !== undefined) {
    const parsed = typeof lengthWeeksInput === "string" ? Number(lengthWeeksInput) : lengthWeeksInput;
    if (!Number.isFinite(parsed) || (parsed !== 4 && parsed !== 8)) {
      return NextResponse.json(
        { error: "lengthWeeks must be 4 or 8" },
        { status: 400 }
      );
    }
    lengthWeeks = parsed;
  }

  let startDate: Date;
  if (startDateStr !== undefined && startDateStr !== null && startDateStr !== "") {
    const parsed = parseLocalYmd(startDateStr);
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
    where: { active: true, trackerTypeId: tracker.trackerTypeId },
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

  let goalWeight: number | undefined;
  if (goalWeightInput !== undefined && goalWeightInput !== null && goalWeightInput !== "") {
    const parsed = positiveNumber(goalWeightInput, "goalWeight");
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    goalWeight = parsed.value;
  }

  const created = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {

    return tx.round.create({
      data: {
        personId,
        trackerId: tracker.id,
        startDate,
        lengthWeeks,
        ...(goalWeight !== undefined ? { goalWeight } : {}),
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
      select: { id: true, trackerId: true },
    });
  });

  return NextResponse.json(created, { status: 201 });
}
