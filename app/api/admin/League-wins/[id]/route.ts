// app/api/admin/league-wins/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
export async function GET(_: Request, { params }: { params: { id: string } }) {
  const rows = await prisma.teamWin.findMany({
    where: { leagueId: params.id },
    orderBy: { teamId: "asc" },
  });
  return NextResponse.json({ env: envFingerprint(), count: rows.length, rows });
}
