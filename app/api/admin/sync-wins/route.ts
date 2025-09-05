
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

  console.log("[CRON] starting sync", envFingerprint());
  // 3) Fetch wins from provider
  const provider = getWinsProvider();
  const latest = await provider.fetchWins({ season: year, week });

console.log("[CRON] provider:", provider.name, "season:", year, "rawKeys:", Object.keys(latest).length);
  // 4) Build updates safely (clamp, ignore unknown teams)
  const updates = Object.entries(latest)
    .filter(([teamId]) => KNOWN.has(teamId))
    .map(([teamId, wins]) => ({ teamId, wins: Math.max(0, Math.min(20, Number(wins) || 0)) }));

      console.log("[CRON] updates", updates.length, updates.slice(0, 5));
  if (process.env.WINS_AUTO_SYNC_DRY_RUN === "true") {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      provider: provider.name,
      season: year,
      count: updates.length,
      env: envFingerprint(),
      updates,
    });
  }

  // 5) Apply to every league (single-season app); or filter by season if you add seasons
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
      } catch (err) {
        try {
          await prisma.teamWin.create({ data: { leagueId: id, teamId, wins } });
          created++;
        } catch (e) {
          console.error("❌ Create failed", { leagueId: id, teamId, wins, e });
          failed++;
        }
      }
    }

  await emitLeagueUpdate(id, { type: "wins-sync" });
  }
console.log("[CRON] done summary", {
    updated, created, failed, leagues: leagues.length, ...envFingerprint(),
  });

  return NextResponse.json({
    ok: true,
    provider: provider.name,
    season: year,
    count: updates.length,
    updated,
    created,
    failed,
    env: envFingerprint(),
  });
  }