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
