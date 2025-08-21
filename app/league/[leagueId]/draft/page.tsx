// app/league/[leagueId]/draft/page.tsx
import { notFound } from "next/navigation";
import { getLeagueByKey } from "@/lib/league";
import LeagueTabs from "@/components/LeagueTabs";
import DraftBoard from "@/components/DraftBoard";
import { prisma } from "@/lib/db";

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
      <h1 className="text-3xl font-bold">{league.name}</h1>
      <LeagueTabs leagueKey={leagueKey} />
       </div>
  );
}

async function getLeagueMeta(id: string) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/leagues/${id}`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

function LeagueCodeBanner() {
  // Lightweight client fetch could also be done if you prefer
  return null; // keep it simple for now; or add a client component to show code
}
