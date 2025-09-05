// app/api/cron/wins/route.ts

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // <--- prevents build-time errors

export async function GET() {
  const token = process.env.ADMIN_TOKEN;
  const baseUrl = process.env.NEXTAUTH_URL || "https://nextjs-boilerplate-lzh4urelg-ryan-von-hoffs-projects.vercel.app";

  try {
    const res = await fetch(`${baseUrl}/api/admin/sync-wins`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    const json = await res.json().catch(() => ({}));
    return NextResponse.json(json, { status: res.status });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
