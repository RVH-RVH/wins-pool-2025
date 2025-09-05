// app/api/cron/wins/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  // Pick a base URL (prefer the deployed origin)
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXTAUTH_URL ||
    "https://nextjs-boilerplate-kappa-mauve-4rndq5xirr.vercel.app";

  const token = process.env.ADMIN_TOKEN;

  if (!token) {
    return NextResponse.json(
      { ok: false, error: "ADMIN_TOKEN missing" },
      { status: 500 }
    );
  }

  const syncUrl = `${baseUrl}/api/admin/sync-wins`;
  console.log("🔁 Calling sync-wins at:", syncUrl);

  try {
    const res = await fetch(syncUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      // pass season/week if you want: body: JSON.stringify({ season: 2025 })
      body: JSON.stringify({}),
      cache: "no-store",
    });

    const json = await res.json().catch(() => ({}));
    return NextResponse.json(
      { ok: res.ok, json, status: res.status, called: syncUrl },
      { status: res.status }
    );
  } catch (err: any) {
    console.error("❌ Cron sync error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message ?? "cron failed", called: syncUrl },
      { status: 500 }
    );
  }
}

