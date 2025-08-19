import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getWinsProvider } from "@/lib/wins/provider";
import { emitLeagueUpdate } from "@/lib/pusher";

// Normalize to our internal 32 team IDs (already used across your app)
const KNOWN = new Set([
  "BUF","MIA","NE","NYJ","BAL","CIN","CLE","PIT","HOU","IND","JAX","TEN",
  "DEN","KC","LV","LAC","DAL","NYG","PHI","WAS","CHI","DET","GB","MIN",
  "ATL","CAR","NO","TB","ARI","LA","SF","SEA"
]);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  // 1) Gate behind feature flag + admin token
  if (process.env.WINS_AUTO_SYNC_ENABLED !== "true") {
    return NextResponse.json({ ok: false, error: "disabled" }, { status: 403 });
  }
  const auth = req.headers.get("authorization");
  if (!auth || auth !== `Bearer ${process.env.ADMIN_TOKEN}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // 2) Parse input
  const { season, week } = await req.json().catch(() => ({}));
  const year = Number.isFinite(+season) ? +season : new Date().getFullYear();

  // 3) Fetch wins from provider
  const provider = getWinsProvider();
  const latest = await provider.fetchWins({ season: year, week });

  // 4) Build updates safely (clamp, ignore unknown teams)
  const updates = Object.entries(latest)
    .filter(([teamId]) => KNOWN.has(teamId))
    .map(([teamId, wins]) => ({ teamId, wins: Math.max(0, Math.min(20, Number(wins) || 0)) }));

  if (process.env.WINS_AUTO_SYNC_DRY_RUN === "true") {
    return NextResponse.json({ ok: true, dryRun: true, provider: provider.name, season: year, count: updates.length, updates }, { status: 200 });
  }

  // 5) Apply to every league (single-season app); or filter by season if you add seasons
  const leagues = await prisma.league.findMany({ select: { id: true } });

  for (const { id } of leagues) {
    for (const { teamId, wins } of updates) {
      try {
        await prisma.teamWin.update({
          where: { leagueId_teamId: { leagueId: id, teamId } },
          data: { wins },
        });
      } catch {
        await prisma.teamWin.create({ data: { leagueId: id, teamId, wins } });
      }
    }
    await emitLeagueUpdate(id, { type: "wins-sync" }); // fanout to clients
  }

  return NextResponse.json({ ok: true, provider: provider.name, season: year, count: updates.length }, { status: 200 });
}

