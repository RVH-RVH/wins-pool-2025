
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getWinsProvider } from "@/lib/wins/provider";
import { emitLeagueUpdate } from "@/lib/pusher";


// --- helper: log env + DB fingerprint safely ---
function envFingerprint() {
  const db = process.env.DATABASE_URL || "";
  let host = "unknown", dbname = "unknown";
  try {
    const u = new URL(db.replace(/^prisma\+/, "")); // strip prisma+ if present
    host = u.host;                 // e.g. xyz.supabase.co:5432
    dbname = u.pathname.replace("/", "");
  } catch {}
  return {
    vercelEnv: process.env.VERCEL_ENV,   // "production" | "preview" | "development"
    nodeEnv: process.env.NODE_ENV,
    dbHost: host,
    dbName: dbname,
    dryRun: process.env.WINS_AUTO_SYNC_DRY_RUN,
  };
}
// Normalize to our internal 32 team IDs (already used across your app)
const KNOWN = new Set([
  "BUF","MIA","NE","NYJ","BAL","CIN","CLE","PIT","HOU","IND","JAX","TEN",
  "DEN","KC","LV","LAC","DAL","NYG","PHI","WAS","CHI","DET","GB","MIN",
  "ATL","CAR","NO","TB","ARI","LA","SF","SEA"
]);
// Optional aliases if anything slips through from provider
const ALIASES: Record<string,string> = { LAR:"LA", JAC:"JAX", WSH:"WAS", ARZ:"ARI", SD:"LAC", OAK:"LV" };
const fix = (id: string) => ALIASES[id] ?? id;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  if (process.env.WINS_AUTO_SYNC_ENABLED !== "true") {
    return NextResponse.json({ ok:false, error:"disabled" }, { status:403 });
  }
  const auth = req.headers.get("authorization");
  if (!auth || auth !== `Bearer ${process.env.ADMIN_TOKEN}`) {
    return NextResponse.json({ ok:false, error:"unauthorized" }, { status:401 });
  }

  const { season, week } = await req.json().catch(() => ({} as any));
  const year = Number.isFinite(+season) ? +season : new Date().getFullYear();

  const provider = getWinsProvider();
  const latest = await provider.fetchWins({ season: year, week }); // <-- define latest here

  const updates = Object.entries(latest)
    .map(([id, w]) => [fix(id), w] as const)
    .filter(([teamId]) => KNOWN.has(teamId))
    .map(([teamId, wins]) => ({ teamId, wins: Math.max(0, Math.min(20, Number(wins) || 0)) }));

// after: const updates = [...]
if (!updates.length) {
  console.warn("[CRON] No updates computed — skipping write");
  return NextResponse.json({ ok:false, error:"no-updates", count: 0 });
}

// 1) Skip if all zeros (preseason/temporary outage)
const nonZero = updates.some(u => u.wins > 0);
if (!nonZero) {
  console.warn("[CRON] All wins are zero; skipping DB write to avoid clobber.");
  return NextResponse.json({ ok:false, error:"all-zero-skip", count: updates.length });
}

    if (process.env.WINS_AUTO_SYNC_DRY_RUN === "true") {
    return NextResponse.json({ ok:true, dryRun:true, count:updates.length, updates });
  }

  const leagues = await prisma.league.findMany({ select: { id: true } });
  let updated = 0, created = 0, failed = 0;

  for (const { id } of leagues) {
    for (const { teamId, wins } of updates) {
      try {
        await prisma.teamWin.update({
          where: { leagueId_teamId: { leagueId: id, teamId } },
          data: { wins },
        });
        updated++;
      } catch {
        try {
          await prisma.teamWin.create({ data: { leagueId: id, teamId, wins } });
          created++;
        } catch (e) {
          failed++;
          console.error("Create failed", { leagueId: id, teamId, wins, e });
        }
      }
    }
    await emitLeagueUpdate(id, { type: "wins-sync" });
  }

  return NextResponse.json({ ok:true, count:updates.length, updated, created, failed });
}