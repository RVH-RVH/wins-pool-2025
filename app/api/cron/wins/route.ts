import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const token = process.env.ADMIN_TOKEN;
  const baseUrl = process.env.NEXTAUTH_URL || "https://nextjs-boilerplate-kappa-mauve-4rndq5xirr.vercel.app";

  try {
    const res = await fetch(`${baseUrl}/api/admin/sync-wins`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    let json: any;
try {
  json = await res.json();
} catch (e) {
  json = { error: 'Failed to parse JSON response', status: res.status };
}

console.log("Cron internal sync status:", res.status);
console.log("Response body:", json);
    return NextResponse.json({ ok: res.ok, json, status: res.status }, { status: res.status });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }

}
