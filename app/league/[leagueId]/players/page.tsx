// app/league/[leagueId]/players/page.tsx
import PlayersForm from "@/components/PlayersForm";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ApiLeagueResp = {
  league: { id: string; code?: string; name: string; teamsPerPlayer?: number; snake?: boolean };
  players: Array<{ id: string; name: string; order: number; userId: string | null }>;
};

async function getLeague(leagueKey: string) {
  // Use a RELATIVE fetch so it works in prod and dev without NEXTAUTH_URL
  const res = await fetch(`/api/leagues/${encodeURIComponent(leagueKey)}`, {
    cache: "no-store",
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    console.error("Failed to fetch league", leagueKey, res.status);
    throw new Error(`Fetch failed: ${res.status}`);
  }

  const data = (await res.json()) as ApiLeagueResp | null;
  if (!data?.league) return null;
  return data;
}

export default async function PlayersPage({ params }: { params: { leagueId?: string } }) {
  const leagueKey = params.leagueId;
  if (!leagueKey) {
    console.error("Missing leagueId param");
    return notFound();
  }

  const data = await getLeague(leagueKey);
  if (!data) return notFound();

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">{data.league.name}</h1>
      <PlayersForm leagueId={leagueKey} initialPlayers={data.players} />
    </div>
  );
}

