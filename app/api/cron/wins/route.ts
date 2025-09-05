import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const baseUrl = process.env.NEXTAUTH_URL || "https://nextjs-boilerplate-kappa-mauve-4rndq5xirr.vercel.app";
  const token = process.env.ADMIN_TOKEN;

  const syncUrl = `${baseUrl}/api/admin/sync-wins`;
  console.log("🔁 Calling sync-wins at:", syncUrl);

  try {
    const res = await fetch(syncUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    const json = await res.json().catch(() => ({}));
    return NextResponse.json({ ok: res.ok, json, status: res.status }, { status: res.status });
  } catch (err: any) {
    console.error("❌ Cron sync error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

