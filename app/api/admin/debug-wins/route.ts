// app/api/admin/debug-wins/route.ts
import { NextResponse } from "next/server";
import { getWinsProvider } from "@/lib/wins/provider";

const KNOWN = new Set([
  "BUF","MIA","NE","NYJ","BAL","CIN","CLE","PIT","HOU","IND","JAX","TEN",
  "DEN","KC","LV","LAC","DAL","NYG","PHI","WAS","CHI","DET","GB","MIN",
  "ATL","CAR","NO","TB","ARI","LA","SF","SEA",
]);
const ALIASES: Record<string,string> = { LAR:"LA", JAC:"JAX", WSH:"WAS", ARZ:"ARI", SD:"LAC", OAK:"LV" };
const fix = (id: string) => ALIASES[id] ?? id;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const season = new Date().getFullYear();
  const provider = getWinsProvider();

  let latest: Record<string, number> = {};
  try {
    latest = await provider.fetchWins({ season });
  } catch (e: any) {
    return NextResponse.json({ ok:false, error:`provider error: ${e?.message}` }, { status: 500 });
  }

  const rawKeys = Object.keys(latest);
  const normalized = Object.fromEntries(
    rawKeys.map(k => [fix(k), latest[k]])
  );
  const kept = Object.fromEntries(
    Object.entries(normalized).filter(([k]) => KNOWN.has(k))
  );
  const dropped = rawKeys
    .map(fix)
    .filter(k => !KNOWN.has(k));

  const nonZero = Object.entries(kept).filter(([,v]) => Number(v) > 0);

  return NextResponse.json({
    ok: true,
    season,
    provider: provider.name,
    rawCount: rawKeys.length,
    sampleRaw: Object.fromEntries(Object.entries(latest).slice(0,8)),
    droppedIdsAfterAlias: Array.from(new Set(dropped)).sort(),
    keptCount: Object.keys(kept).length,
    nonZeroCount: nonZero.length,
    sampleKept: Object.fromEntries(Object.entries(kept).slice(0,8)),
  });
}
