// app/league/[leagueId]/players/page.tsx
import PlayersForm from "@/components/PlayersForm";
import { notFound } from "next/navigation";

async function getLeague(leagueId: string) {
  try {
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/leagues/${leagueId}`, { cache: "no-store" });

    if (!res.ok) {
      console.error(`Failed to fetch league ${leagueId}: ${res.status}`);
      return null;
    }

    const data = await res.json();
    if (!data?.league) {
      console.error(`No league data in response for ${leagueId}`);
      return null;
    }

    return data;
  } catch (err) {
    console.error(`Error fetching league ${leagueId}`, err);
    return null;
  }
}

export default async function PlayersPage({ params }: { params: { leagueId?: string } }) {
  const leagueId = params.leagueId;

  if (!leagueId) {
    console.error("Missing leagueId param");
    return notFound();
  }

  const data = await getLeague(leagueId);
  if (!data) return notFound();

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">{data.league.name}</h1>
      <PlayersForm leagueId={leagueId} initialPlayers={data.players} />
    </div>
  );
}

