import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requiredName } from "@/lib/validation";

const DEFAULT_TRACKER_TYPE_NAME = "Default";

export async function GET() {
  const people = await prisma.person.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json(people);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const nameResult = requiredName(body?.name, "name");
  if ("error" in nameResult) {
    return NextResponse.json({ error: nameResult.error }, { status: 400 });
  }
  const name = nameResult.value;

  const person = await prisma.$transaction(async (tx) => {
    const trackerType = await tx.trackerType.upsert({
      where: { name: DEFAULT_TRACKER_TYPE_NAME },
      update: { active: true },
      create: { name: DEFAULT_TRACKER_TYPE_NAME, active: true },
      select: { id: true },
    });

    const created = await tx.person.create({ data: { name } });

    await tx.tracker.create({
      data: {
        personId: created.id,
        trackerTypeId: trackerType.id,
        name: DEFAULT_TRACKER_TYPE_NAME,
      },
    });

    return created;
  });

  return NextResponse.json(person, { status: 201 });
}
