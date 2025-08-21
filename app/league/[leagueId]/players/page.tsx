import TopNav from "@/components/TopNav";
import Nav from "@/components/Nav";
import PlayersForm from "@/components/PlayersForm";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PlayersPage({ params }: { params: { leagueId: string } }) {
  const key = params.leagueId;

  // Resolve league by id OR code
  const league =
    (await prisma.league.findUnique({ where: { id: key } })) ??
    (await prisma.league.findUnique({ where: { code: key } }));

  if (!league) return notFound();

  const players = await prisma.player.findMany({
    where: { leagueId: league.id },
    orderBy: { order: "asc" },
  });

  const leagueKey = league.code ?? league.id;

  return (
    <div>
      <TopNav />
      <main className="p-6 max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">{league.name}</h1>
        <Nav leagueId={encodeURIComponent(leagueKey)} />
        <PlayersForm leagueId={leagueKey} initialPlayers={players} />
      </main>
    </div>
  );
}

