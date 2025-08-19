// app/api/_debug/db/route.ts  (or src/app/... if you use src/)
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const leagues = await prisma.league.findMany({
      take: 3,
      select: { id: true, name: true },
    });
    return NextResponse.json({
      ok: true,
      message: "DB connection successful",
      sampleLeagues: leagues,
    });
  } catch (err: any) {
    console.error("DB debug error:", err);
    return NextResponse.json(
      { ok: false, error: err.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}


