import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { makeLeagueCode } from "@/lib/code";
import { emitLeagueUpdate } from "@/lib/pusher";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const name = (body?.name ?? "2025 NFL Wins Pool").toString().slice(0, 100);
  const teamsPerPlayer = Number.isFinite(+body?.teamsPerPlayer) ? Math.max(1, Math.min(10, +body.teamsPerPlayer)) : 6;
  const snake = body?.snake === false ? false : true;

  // Allow custom code, otherwise generate one (retry on collision)
  let code = (body?.code ?? "").toString().trim().toUpperCase();
  async function uniqueCode() {
    if (code) {
      const exists = await prisma.league.findUnique({ where: { code } });
      if (!exists) return code;
      code = ""; // fall through to generator
    }
    for (let i = 0; i < 10; i++) {
      const candidate = makeLeagueCode();
      const exists = await prisma.league.findUnique({ where: { code: candidate } });
      if (!exists) return candidate;
    }
    throw new Error("Could not generate unique code");
  }

  const finalCode = await uniqueCode();

  const league = await prisma.league.create({
    data: { name, teamsPerPlayer, snake, code: finalCode },
  });

  // Seed players (x5) and team wins
  const players = Array.from({ length: 5 }).map((_, i) => ({
    leagueId: league.id, name: `Player ${i + 1}`, order: i,
  }));
  await prisma.player.createMany({ data: players });

  const teamIds = ["BUF","MIA","NE","NYJ","BAL","CIN","CLE","PIT","HOU","IND","JAX","TEN","DEN","KC","LV","LAC","DAL","NYG","PHI","WAS","CHI","DET","GB","MIN","ATL","CAR","NO","TB","ARI","LA","SF","SEA"];
  await prisma.teamWin.createMany({ data: teamIds.map(tid => ({ leagueId: league.id, teamId: tid, wins: 0 })) });

  return NextResponse.json({ id: league.id, code: finalCode }, { status: 201 });
}
