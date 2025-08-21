// app/league/[leagueId]/players/page.tsx
import { notFound } from "next/navigation";
import { getLeagueByKey } from "@/lib/league";
// import LeagueTabs from "@/components/LeagueTabs";
import PlayersForm from "@/components/PlayersForm";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;


// Removed duplicate code block referencing 'league' before definition

type ApiLeagueResp = {
  league: { id: string; code?: string; name: string; teamsPerPlayer?: number; snake?: boolean };
  players: Array<{ id: string; name: string; order: number; userId: string | null }>;
};

import { headers } from "next/headers";

async function getBaseUrl() {
  // Use NEXTAUTH_URL if defined (Vercel best practice)
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL;

  // Otherwise build it dynamically from the request headers
  const h = headers();
  const host = h.get("host")!;
  const proto = process.env.NODE_ENV === "development" ? "http" : "https";
  return `${proto}://${host}`;
}

async function getLeague(leagueId: string) {
  const baseUrl = await getBaseUrl();
  const res = await fetch(`${baseUrl}/api/leagues/${leagueId}`, {
    cache: "no-store",
  });

  if (!res.ok) throw new Error("League not found");
  return res.json();
}

export default async function PlayersPage({ params }: { params: { leagueId: string } }) {
  const key = params.leagueId;

  const league =
    (await prisma.league.findUnique({ where: { id: key } })) ??
    (await prisma.league.findUnique({ where: { code: key } }));

  if (!league) return notFound();

  const players = await prisma.player.findMany({
    where: { leagueId: league.id },
    orderBy: { order: "asc" },
  });

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">{league.name}</h1>
      <PlayersForm leagueId={key} initialPlayers={players.map(p => ({
        id: p.id, name: p.name, order: p.order, userId: p.userId
      }))} />
    </div>
  );
}