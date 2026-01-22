import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ personId: string }> }
) {
  const { personId } = await ctx.params;

  if (!personId) {
    return NextResponse.json(
      { error: "personId is required" },
      { status: 400 }
    );
  }

  const person = await prisma.person.findUnique({
    where: { id: personId },
    select: {
      id: true,
      name: true,
    },
  });

  if (!person) {
    return NextResponse.json(
      { error: "Person not found" },
      { status: 404 }
    );
  }

  return NextResponse.json(person);
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ personId: string }> }
) {
  const { personId } = await ctx.params;

  if (!personId) {
    return NextResponse.json({ error: "personId is required" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const name = (body?.name as string | undefined)?.trim();

  if (!name) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }

  const exists = await prisma.person.findUnique({
    where: { id: personId },
    select: { id: true },
  });

  if (!exists) {
    return NextResponse.json({ error: "Person not found" }, { status: 404 });
  }

  const updated = await prisma.person.update({
    where: { id: personId },
    data: { name },
    select: { id: true, name: true },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ personId: string }> }
) {
  const { personId } = await ctx.params;

  if (!personId) {
    return NextResponse.json({ error: "personId is required" }, { status: 400 });
  }

  const exists = await prisma.person.findUnique({
    where: { id: personId },
    select: { id: true },
  });

  if (!exists) {
    return NextResponse.json({ error: "Person not found" }, { status: 404 });
  }

  // Cascades delete rounds/entries via schema relations.
  await prisma.person.delete({ where: { id: personId } });

  return NextResponse.json({ ok: true });
}
