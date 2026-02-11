import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEFAULT_SETTINGS = {
  id: "singleton",
  roundLengthWeeks: 8,
  weekStartsOn: 0,
  timezone: "America/New_York",
  weightUnit: "LBS",
};

function normalizeWeightUnit(value: unknown) {
  if (value === undefined || value === null) return null;
  const v = String(value).trim().toUpperCase();
  if (v === "LBS" || v === "LB") return "LBS";
  if (v === "KG" || v === "KGS") return "KG";
  return null;
}

async function getOrCreateSettings() {
  const existing = await prisma.appSettings.findUnique({
    where: { id: "singleton" },
  });
  if (existing) return existing;
  return prisma.appSettings.create({ data: DEFAULT_SETTINGS });
}

export async function GET() {
  const settings = await getOrCreateSettings();
  return NextResponse.json(settings);
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => null);
  const weightUnit = normalizeWeightUnit(body?.weightUnit);

  if (weightUnit === null) {
    return NextResponse.json(
      { error: "weightUnit must be LBS or KG" },
      { status: 400 }
    );
  }

  const updated = await prisma.appSettings.upsert({
    where: { id: "singleton" },
    update: { weightUnit },
    create: { ...DEFAULT_SETTINGS, weightUnit },
  });

  return NextResponse.json(updated);
}
