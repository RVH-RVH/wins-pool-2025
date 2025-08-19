import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  const email = (body.email || "").toLowerCase().trim();
  const password = (body.password || "").toString();
  const name = (body.name || "").toString();

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }

  const hash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: { email, passwordHash: hash, name: name || null },
  });

  return NextResponse.json({ ok: true });
}
