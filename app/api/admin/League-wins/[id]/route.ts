// app/api/admin/league-wins/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// helper: safe env/DB fingerprint (no secrets)
function envFingerprint() {
  const db = process.env.DATABASE_URL || "";
  let host = "unknown", dbname = "unknown";
  try {
    const u = new URL(db.replace(/^prisma\+/, "")); // strip prisma+ if present
    host = u.host;                 // e.g. abc.supabase.co:5432
    dbname = u.pathname.replace("/", "");
  } catch {}
  return {
    vercelEnv: process.env.VERCEL_ENV,     // "production" | "preview" | "development"
    nodeEnv: process.env.NODE_ENV,
    dbHost: host,
    dbName: dbname,
  };
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const rows = await prisma.teamWin.findMany({
    where: { leagueId: params.id },
    orderBy: { teamId: "asc" },
  });
  return NextResponse.json({
    env: envFingerprint(),
    count: rows.length,
    rows,
  });
}
