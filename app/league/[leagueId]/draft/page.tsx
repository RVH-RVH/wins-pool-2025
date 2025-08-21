// app/league/[leagueId]/draft/page.tsx
import TopNav from "@/components/TopNav";
import Nav from "@/components/Nav";
import DraftBoard from "@/components/DraftBoard";
import { prisma } from "@/lib/db";
import { getLeagueByKey } from "@/lib/league";
import { notFound } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DraftPage({ params }: { params: { leagueId: string } }) {
  const key = params.leagueId;
  const league = await getLeagueByKey(key);
  if (!league) return notFound();

  const [players, picks] = await Promise.all([
    prisma.player.findMany({ where: { leagueId: league.id }, orderBy: { order: "asc" } }),
    prisma.pick.findMany({ where: { leagueId: league.id }, orderBy: { pickNumber: "asc" } }),
  ]);

  const leagueKey = league.code ?? league.id;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <TopNav />
      <h1 className="text-3xl font-bold">{league.name}</h1>
      <Nav leagueKey={leagueKey} />
    </div>
  );
}
