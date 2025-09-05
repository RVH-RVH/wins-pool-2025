import { NextResponse } from "next/server";

const baseUrl = process.env.NEXTAUTH_URL || "https://nextjs-boilerplate-kappa-mauve-4rndq5xirr.vercel.app";
const syncUrl = `${baseUrl}/api/admin/sync-wins`; // adjust if your file is not in /admin/
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const token = process.env.ADMIN_TOKEN;
  const baseUrl = process.env.NEXTAUTH_URL || "https://nextjs-boilerplate-kappa-mauve-4rndq5xirr.vercel.app";


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
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }

}
