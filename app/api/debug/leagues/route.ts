// app/api/debug/leagues/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const leagues = await prisma.league.findMany({
    select: { id: true, code: true, name: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  return NextResponse.json({ ok: true, leagues });
}
