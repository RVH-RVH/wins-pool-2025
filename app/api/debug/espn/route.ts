import { NextResponse } from "next/server";
import { EspnProvider } from "@/lib/wins/provider";

export const runtime = "nodejs";

export async function GET() {
  const provider = new EspnProvider();
  const wins = await provider.fetchWins({});
  return NextResponse.json(wins);
}
