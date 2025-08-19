import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(_: Request, { params }: { params: { code: string } }) {
  const raw = params.code || "";
  const code = raw.trim().toUpperCase();
  const league = await prisma.league.findUnique({ where: { code } });
  if (!league) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ id: league.id, code: league.code }, { status: 200 });
}
