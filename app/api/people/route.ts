import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const people = await prisma.person.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json(people);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const name = body?.name?.trim();
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
  const person = await prisma.person.create({ data: { name } });
  return NextResponse.json(person, { status: 201 });
}