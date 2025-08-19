export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions"; // see note below

function isAdmin(email?: string | null) {
  const raw = process.env.ADMIN_EMAILS || "";
  const list = raw.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  return !!email && list.includes(email.toLowerCase());
}

export async function POST(req: Request) {
  type Session = { user?: { email?: string | null } | null } | null;
  const session = await getServerSession(authOptions as any) as Session;
  const email = session?.user?.email ?? null;

  if (!isAdmin(email)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const token = process.env.ADMIN_TOKEN;
  if (!token) {
    return NextResponse.json({ ok: false, error: "ADMIN_TOKEN missing" }, { status: 500 });
  }

  // pass through body (season/week) if provided
  let body: any = {};
  try { body = await req.json(); } catch {}

  // call the real admin route with server-side Authorization header
  const res = await fetch(`${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/admin/sync-wins`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => ({}));
  return NextResponse.json(json, { status: res.status });
}

