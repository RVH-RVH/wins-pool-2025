// app/api/leagues/[id]/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { emitLeagueUpdate } from "@/lib/pusher"; // ← switched from events to pusher


export async function GET(_: Request, { params }: { params: { id: string } }) {
  const id = params.id;
  const league =
    (await prisma.league.findUnique({ where: { id: id } })) ??
    (await prisma.league.findUnique({ where: { code: id } }));
  if (!league) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const [players, picks, wins] = await Promise.all([
    prisma.player.findMany({ where: { leagueId: league.id }, orderBy: { order: "asc" } }),
    prisma.pick.findMany({ where: { leagueId: league.id }, orderBy: { pickNumber: "asc" } }),
    prisma.teamWin.findMany({ where: { leagueId: league.id } }),
  ]);
  if (!league) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
   return NextResponse.json({
    league: { id: league.id, code: league.code, name: league.name, teamsPerPlayer: league.teamsPerPlayer, snake: league.snake },
    players: players.map(p => ({ id: p.id, name: p.name, order: p.order, userId: p.userId })),
    picks,
    teamWins: Object.fromEntries(wins.map(w => [w.teamId, w.wins])),
  });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const id = params.id;
  console.log("[PATCH /api/leagues/:id] leagueId =", id);

let body: any = {};
try {
  body = await req.json();
} catch {
  body = {};
}
  console.log("[PATCH /api/leagues/:id]", {
    id,
    ua: req.headers.get("user-agent"),
    referer: req.headers.get("referer"),
    when: new Date().toISOString(),
  });

  console.log("[PATCH body]", JSON.stringify(body));

console.log("[PATCH body]", JSON.stringify(body, null, 2));

console.log("[PATCH leagues]", {
  id,
  ua: req.headers.get("user-agent"),
  referer: req.headers.get("referer"),
  when: new Date().toISOString(),
});

  // Optional league meta updates
  const name =
    typeof body?.leagueName === "string" ? body.leagueName.slice(0, 100) : undefined;
  const teamsPerPlayer = Number.isFinite(+body?.teamsPerPlayer)
    ? Math.max(1, Math.min(10, +body.teamsPerPlayer))
    : undefined;
  const snake = typeof body?.snake === "boolean" ? body.snake : undefined;

  if (name || teamsPerPlayer !== undefined || snake !== undefined) {
    await prisma.league.update({
      where: { id },
      data: {
        name: name ?? undefined,
        teamsPerPlayer: teamsPerPlayer ?? undefined,
        snake: snake ?? undefined,
      },
    });
  }

  // --- robust players update: UPSERT 0..4 by (leagueId, order) ---
  let playerIdMap: Map<string, string> | undefined;

if (Array.isArray(body?.players)) {
  const incoming = (body.players as any[]).slice(0, 5).map((p: any, i: number) => ({
    clientId: typeof p.id === "string" ? p.id : `__idx_${i}`,
    rawName: typeof p?.name === "string" ? p.name : "",
    order: i, // canonical 0..4
    userId: p?.userId ?? null,
  }));

  // Load existing names to avoid overwriting with blanks/defaults
  const existing = await prisma.player.findMany({
    where: { leagueId: id },
    select: { id: true, order: true, name: true },
  });
  const byOrder = new Map<number, { id: string; name: string }>();
  for (const e of existing) byOrder.set(e.order, { id: e.id, name: e.name });

  // Helper: is a placeholder like "Player 1"
  const isDefault = (s: string, order: number) =>
    s.trim().toLowerCase() === `player ${order + 1}`.toLowerCase();

  // Build final records with name preservation
  const final = incoming.map((p) => {
    const trimmed = p.rawName.trim();
    const keepExisting =
      trimmed.length === 0 || isDefault(trimmed, p.order);

    const finalName =
      keepExisting
        ? (byOrder.get(p.order)?.name ?? `Player ${p.order + 1}`)
        : trimmed;

    return {
      clientId: p.clientId,
      order: p.order,
      name: finalName,
      userId: p.userId,
    };
  });

 const upserts = await prisma.$transaction(
    final.map((p) =>
      prisma.player.upsert({
        where: { leagueId_order: { leagueId: id, order: p.order } },
        create: { leagueId: id, order: p.order, name: p.name, userId: p.userId },
        update: { name: p.name, userId: p.userId },
        select: { id: true, order: true },
      })
    )
  );
    // Optional: ensure no stray players beyond 0..4
    await prisma.player.deleteMany({
      where: { leagueId: id, order: { gt: incoming.length - 1 } },
    });

      const players = await prisma.player.findMany({
    where: { leagueId: id },
    orderBy: { order: "asc" },
    select: { id: true, name: true, order: true, userId: true },
  });
    // Build id map from client ids → DB ids for the picks remap
    playerIdMap = new Map<string, string>();
    for (const p of incoming) {
      const match = upserts.find((u) => u.order === p.order);
      if (match) playerIdMap.set(p.clientId, match.id);
    }
  }

  // --- picks rewrite using final player IDs ---
  if (Array.isArray(body?.picks)) {
    const picks = body.picks as Array<{
      teamId: string;
      playerId: string;
      pickNumber: number;
    }>;

    const remapped = picks.map((p) => ({
      teamId: p.teamId,
      playerId: playerIdMap?.get(p.playerId) ?? p.playerId, // map temp/old id → upserted id
      pickNumber: p.pickNumber,
    }));

    await prisma.pick.deleteMany({ where: { leagueId: id } });
    if (remapped.length) {
      await prisma.pick.createMany({
        data: remapped.map((p) => ({ ...p, leagueId: id })),
        skipDuplicates: true,
      });
    }
  }

  // --- wins update (unchanged) ---
  if (body?.teamWins && typeof body.teamWins === "object") {
    const entries = Object.entries(body.teamWins as Record<string, number>);
    for (const [teamId, wins] of entries) {
      const val = Number.isFinite(+wins) ? Math.max(0, Math.min(20, +wins)) : 0;
      await prisma.teamWin.update({
        where: { leagueId_teamId: { leagueId: id, teamId } },
        data: { wins: val },
      });
    }
  }

  await emitLeagueUpdate(id, { type: "updated" });
  return NextResponse.json({ ok: true });
}
