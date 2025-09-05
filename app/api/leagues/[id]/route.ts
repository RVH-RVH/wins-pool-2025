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

    // Resolve league
    const league =
      (await prisma.league.findUnique({ where: { id: key } })) ??
      (await prisma.league.findUnique({ where: { code: key } }));
    if (!league) {
      return NextResponse.json({ ok: false, error: "League not found" }, { status: 404 });
    }

    const leagueId = league.id;

    // Normalize inputs
    const name = typeof body?.leagueName === "string" ? body.leagueName.slice(0, 100) : undefined;
    const teamsPerPlayer = Number.isFinite(+body?.teamsPerPlayer)
      ? Math.max(1, Math.min(10, +body.teamsPerPlayer))
      : undefined;
    const snake = typeof body?.snake === "boolean" ? body.snake : undefined;

    const incomingPlayers = Array.isArray(body?.players)
      ? body.players.slice(0, 5).map((p: any, i: number) => ({
          id: typeof p.id === "string" ? p.id : undefined,
          name: (p?.name || `Player ${i + 1}`).toString().slice(0, 80),
          order: i,
          userId: p?.userId ?? null,
        }))
      : [];

    const incomingPicks = Array.isArray(body?.picks)
      ? body.picks.map((p: any) => ({
          teamId: String(p.teamId),
          playerId: String(p.playerId),
          pickNumber: Number(p.pickNumber) || 0,
        }))
      : [];

    const incomingWins = typeof body?.teamWins === "object" ? body.teamWins : null;

    // Main transaction
    const result = await prisma.$transaction(async (tx) => {
      // League meta
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

      // Players (if provided)
      let idMap = new Map<string, string>();
      if (incomingPlayers.length > 0) {
        await tx.player.deleteMany({ where: { leagueId } });

        const createdPlayers = await tx.player.createMany({
          data: incomingPlayers.map((p: any) => ({
            leagueId,
            name: p.name,
            order: p.order,
            userId: p.userId,
          })),
          skipDuplicates: true,
        });

        // Get new IDs to rebuild map
        const created = await tx.player.findMany({
          where: { leagueId },
          orderBy: { order: "asc" },
        });
        for (let i = 0; i < created.length; i++) {
          const incoming = incomingPlayers[i];
          const actual = created[i];
          idMap.set(incoming.id ?? `__idx_${i}`, actual.id);
        }
      }

      // Picks (if provided)
      if (incomingPicks.length > 0) {
        const remapped = incomingPicks.map((p: { teamId: string; playerId: string; pickNumber: number }) => {
          const mappedId = idMap.get(p.playerId) ?? p.playerId;
          if (!mappedId) throw new Error(`Could not remap playerId: ${p.playerId}`);
          return { ...p, playerId: mappedId };
        });

        // Optional: validate that all remapped playerIds belong to this league
        const playerIds = [...new Set(remapped.map((p: { teamId: string; playerId: string; pickNumber: number }) => p.playerId))] as string[];
        const owners = await tx.player.findMany({
          where: { id: { in: playerIds } },
          select: { id: true, leagueId: true },
        });
        const badIds = owners.filter((o) => o.leagueId !== leagueId).map((o) => o.id);
        if (badIds.length) {
          throw new Error(`Invalid picks: player(s) not in league: ${badIds.join(",")}`);
        }

        await tx.pick.deleteMany({ where: { leagueId } });
        await tx.pick.createMany({
          data: remapped.map((p: { teamId: string; playerId: string; pickNumber: number }) => ({ ...p, leagueId })),
        });
      }

      // Wins (if provided)
      if (incomingWins) {
        const entries = Object.entries(incomingWins as Record<string, number>);
        for (const [teamId, wins] of entries) {
          const val = Number.isFinite(+wins) ? Math.max(0, Math.min(20, +wins)) : 0;
          await tx.teamWin.update({
            where: { leagueId_teamId: { leagueId, teamId } },
            data: { wins: val },
          });
        }
      }

      return { ok: true, updatedLeagueId: leagueId };
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[PATCH /api/leagues/:id] error", {
      key,
      body,
      message: err?.message,
      stack: err?.stack,
    });
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Internal server error" },
      { status: 400 }
    );
  }
}
