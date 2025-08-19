// app/league/[leagueId]/players/page.tsx
import PlayersForm from "@/components/PlayersForm";

async function getLeague(leagueId: string) {
  const res = await fetch(`${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/leagues/${leagueId}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("League not found");
  return res.json() as Promise<{
    league: { id: string; name: string };
    players: Array<{ id: string; name: string; order: number; userId: string | null }>;
  }>;
}

export default async function PlayersPage({ params }: { params: { leagueId: string } }) {
  const data = await getLeague(params.leagueId);
  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">{data.league.name}</h1>
      {/* Client component renders the editor */}
      <PlayersForm leagueId={params.leagueId} initialPlayers={data.players} />
    </div>
  );
}

