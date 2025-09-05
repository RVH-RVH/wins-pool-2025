// app/api/leagues/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;


// -------- GET: load league (id or code) --------
export async function GET(_: Request, { params }: { params: { id: string } }) {
  const key = params.id;
  try {
    const league =
      (await prisma.league.findUnique({ where: { id: key } })) ??
      (await prisma.league.findUnique({ where: { code: key } }));

    if (!league) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const [players, picks, wins] = await Promise.all([
      prisma.player.findMany({ where: { leagueId: league.id }, orderBy: { order: "asc" } }),
      prisma.pick.findMany({ where: { leagueId: league.id }, orderBy: { pickNumber: "asc" } }),
      prisma.teamWin.findMany({ where: { leagueId: league.id } }),
    ]);

    return NextResponse.json({
      league: {
        id: league.id,
        code: league.code,
        name: league.name,
        teamsPerPlayer: league.teamsPerPlayer,
        snake: league.snake,
      },
      players: players.map(p => ({ id: p.id, name: p.name, order: p.order, userId: p.userId })),
      picks: picks.map(p => ({ id: p.id, teamId: p.teamId, playerId: p.playerId, pickNumber: p.pickNumber })),
      teamWins: Object.fromEntries(wins.map(w => [w.teamId, w.wins])) as Record<string, number>,
    });
  } catch (err) {
    console.error("[GET /api/leagues/:id] error", { key, err });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// -------- PATCH: update league meta, players, picks (transaction) --------
// app/api/leagues/[id]/route.ts (PATCH only)


export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const key = params.id;
  let body: any = {};

  try {
    body = await req.json();

    const league =
      (await prisma.league.findUnique({ where: { id: key } })) ??
      (await prisma.league.findUnique({ where: { code: key } }));

    if (!league) {
      return NextResponse.json({ ok: false, error: "League not found" }, { status: 404 });
    }

    const leagueId = league.id;
    const name = typeof body?.leagueName === "string" ? body.leagueName.slice(0, 100) : undefined;
    const teamsPerPlayer = Number.isFinite(+body?.teamsPerPlayer)
      ? Math.max(1, Math.min(10, +body.teamsPerPlayer))
      : undefined;
    const snake = typeof body?.snake === "boolean" ? body.snake : undefined;

    // Normalize incoming players
    const MAX_PLAYERS = 5;
    const incomingPlayers = Array.isArray(body.players)
      ? body.players.slice(0, MAX_PLAYERS).map((p: any, i: number) => ({
          oldId: p?.id ?? `__idx_${i}`,
          name: (p?.name || `Player ${i + 1}`).toString().slice(0, 80),
          order: i, // enforce 0–4
          userId: p?.userId ?? null,
        }))
      : [];

    // Normalize incoming picks
    const incomingPicks: Array<{ teamId: string; playerId: string; pickNumber: number }> = Array.isArray(body?.picks)
      ? (body.picks as any[]).map((p: any) => ({
          teamId: String(p.teamId),
          playerId: String(p.playerId),
          pickNumber: Number(p.pickNumber) || 0,
        }))
      : [];

    const result = await prisma.$transaction(async (tx) => {
      // Update league metadata
      if (name || teamsPerPlayer !== undefined || snake !== undefined) {
        await tx.league.update({
          where: { id: leagueId },
          data: {
            name: name ?? undefined,
            teamsPerPlayer: teamsPerPlayer ?? undefined,
            snake: snake ?? undefined,
          },
        });
      }

      // Clear existing data
      await tx.pick.deleteMany({ where: { leagueId } });
      await tx.player.deleteMany({ where: { leagueId } });

      // Create players one by one and map old -> new id
      const idMap = new Map<string, string>();
      for (let i = 0; i < incomingPlayers.length; i++) {
        const p = incomingPlayers[i];
        const created = await tx.player.create({
          data: {
            leagueId,
            name: p.name,
            order: p.order,
            userId: p.userId,
          },
          select: { id: true },
        });
        idMap.set(p.oldId, created.id);
      }

      // Re-map picks
      if (incomingPicks.length) {
        const remappedPicks = incomingPicks.map((p) => {
          const newId = idMap.get(p.playerId);
          if (!newId) throw new Error(`Could not remap playerId: ${p.playerId}`);
          return {
            leagueId,
            teamId: p.teamId,
            playerId: newId,
            pickNumber: p.pickNumber,
          };
        });

        await tx.pick.createMany({ data: remappedPicks });
      }

      // Team wins
      if (body?.teamWins && typeof body.teamWins === "object") {
        const entries = Object.entries(body.teamWins as Record<string, number>);
        for (const [teamId, wins] of entries) {
          const val = Number.isFinite(+wins) ? Math.max(0, Math.min(20, +wins)) : 0;
        await tx.teamWin.upsert({
  where: { leagueId_teamId: { leagueId, teamId } },
  update: { wins: val },
  create: {
    leagueId,
    teamId,
    wins: val,
  },
});
        }
      }

      return { leagueId, playersCreated: incomingPlayers.length, picksCreated: incomingPicks.length };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    console.error("[PATCH /api/leagues/:id] error", {
      key,
      body,
      message: err?.message,
      stack: err?.stack,
    });

    return NextResponse.json({ ok: false, error: err?.message ?? "Internal error" }, { status: 400 });
  }
}
