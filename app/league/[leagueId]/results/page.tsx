import TopNav from "@/components/TopNav";
import Nav from "@/components/Nav";
import Results from "@/components/Results";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ResultsPage({ params }: { params: { leagueId: string } }) {
  const key = params.leagueId;

  // Resolve league by id OR code
  const league =
    (await prisma.league.findUnique({ where: { id: key } })) ??
    (await prisma.league.findUnique({ where: { code: key } }));

  if (!league) return notFound();

  const [players, picks, wins] = await Promise.all([
    prisma.player.findMany({ where: { leagueId: league.id }, orderBy: { order: "asc" } }),
    prisma.pick.findMany({ where: { leagueId: league.id }, orderBy: { pickNumber: "asc" } }),
    prisma.teamWin.findMany({ where: { leagueId: league.id } }),
  ]);

  const leagueKey = league.code ?? league.id;
  const teamWins = Object.fromEntries(wins.map(w => [w.teamId, w.wins])) as Record<string, number>;

  return (
    <div>
      <TopNav />
      <main className="p-6 max-w-5xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">{league.name}</h1>
        <Nav leagueId={encodeURIComponent(leagueKey)} />
        <Results/>
      </main>
    </div>
  );
}

