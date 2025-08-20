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
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const key = params.id;
  let body: any = {};
  try {
    body = await req.json().catch(() => ({}));

    // Resolve key -> canonical leagueId
    const league =
      (await prisma.league.findUnique({ where: { id: key } })) ??
      (await prisma.league.findUnique({ where: { code: key } }));

    if (!league) {
      return NextResponse.json({ ok: false, error: "League not found" }, { status: 404 });
    }
    const leagueId = league.id;

    const name =
      typeof body?.leagueName === "string" ? body.leagueName.slice(0, 100) : undefined;
    const teamsPerPlayer =
      Number.isFinite(+body?.teamsPerPlayer) ? Math.max(1, Math.min(10, +body.teamsPerPlayer)) : undefined;
    const snake = typeof body?.snake === "boolean" ? body.snake : undefined;

    // Normalize incoming players (max 5)
    const incomingPlayers: Array<{ id?: string; name: string; order: number; userId: string | null }> =
      Array.isArray(body?.players)
        ? (body.players as any[]).slice(0, 5).map((p: any, i: number) => ({
            id: typeof p.id === "string" ? p.id : undefined,
            name: (p?.name || `Player ${i + 1}`).toString().slice(0, 80),
            order: Number.isFinite(+p?.order) ? +p.order : i,
            userId: p?.userId ?? null,
          }))
        : [];

    // Normalize incoming picks
    const incomingPicks: Array<{ teamId: string; playerId: string; pickNumber: number }> =
      Array.isArray(body?.picks)
        ? (body.picks as any[]).map((p: any) => ({
            teamId: String(p.teamId),
            playerId: String(p.playerId),
            pickNumber: Number(p.pickNumber) || 0,
          }))
        : [];

    const result = await prisma.$transaction(async (tx) => {
      // Update league meta (if provided)
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

      // Players: upsert + build id map
      const existing = await tx.player.findMany({
        where: { leagueId },
        select: { id: true },
      });
      const existingIds = new Set(existing.map((p) => p.id));

      const idMap = new Map<string, string>(); // oldId -> newId

      for (let i = 0; i < incomingPlayers.length; i++) {
        const p = incomingPlayers[i];
        if (p.id && existingIds.has(p.id)) {
          const updated = await tx.player.update({
            where: { id: p.id },
            data: { name: p.name, order: p.order, userId: p.userId },
            select: { id: true },
          });
          idMap.set(p.id, updated.id);
        } else {
          const created = await tx.player.create({
            data: { leagueId, name: p.name, order: p.order, userId: p.userId },
            select: { id: true },
          });
          idMap.set(p.id ?? `__idx_${i}`, created.id);
        }
      }

      // OPTIONAL strict sync: delete players not in payload
      // const keepIds = new Set([...idMap.values()]);
      // await tx.player.deleteMany({ where: { leagueId, id: { notIn: [...keepIds] } } });

      // Picks: validate player ownership, then replace all
      if (incomingPicks.length) {
        // Remap playerIds if client sent temp/old ids
        const remapped = incomingPicks.map((p) => ({
          teamId: p.teamId,
          playerId: idMap.get(p.playerId) ?? p.playerId,
          pickNumber: p.pickNumber,
        }));

        // Validate: all playerIds belong to this league
        const playerIds = [...new Set(remapped.map((p) => p.playerId))];
        const owners = await tx.player.findMany({
          where: { id: { in: playerIds } },
          select: { id: true, leagueId: true },
        });
        const badIds = new Set(
          owners.filter((o) => o.leagueId !== leagueId).map((o) => o.id)
        );
        if (badIds.size) {
          throw new Error(
            `Invalid picks: some playerIds do not belong to league ${leagueId}: ${[...badIds].join(",")}`
          );
        }

        await tx.pick.deleteMany({ where: { leagueId } });
        await tx.pick.createMany({
          data: remapped.map((p) => ({ ...p, leagueId })),
          skipDuplicates: true,
        });
      }

      // Team wins (optional)
      if (body?.teamWins && typeof body.teamWins === "object") {
        const entries = Object.entries(body.teamWins as Record<string, number>);
        for (const [teamId, wins] of entries) {
          const val = Number.isFinite(+wins) ? Math.max(0, Math.min(20, +wins)) : 0;
          await tx.teamWin.update({
            where: { leagueId_teamId: { leagueId, teamId } },
            data: { wins: val },
          });
        }
      }

      return { leagueId, idMapSize: idMap.size };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    console.error("[PATCH /api/leagues/:id] error", {
      key: params.id,
      body,
      message: err?.message,
      stack: err?.stack,
    });
    // Return a 400 with message so the client can show an inline error
    return NextResponse.json({ ok: false, error: err?.message ?? "Internal error" }, { status: 400 });
  }
}
