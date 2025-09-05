// app/api/leagues/[id]/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// --- helper: safe env/DB fingerprint (no secrets) ---
function envFingerprint() {
  const db = process.env.DATABASE_URL || "";
  let host = "unknown", dbname = "unknown";
  try {
    const u = new URL(db.replace(/^prisma\+/, "")); // strip prisma+ if present
    host = u.host;                 // e.g. xyz.supabase.co:5432
    dbname = u.pathname.replace("/", "");
  } catch {}
  return {
    vercelEnv: process.env.VERCEL_ENV,   // "production" | "preview" | "development"
    nodeEnv: process.env.NODE_ENV,
    dbHost: host,
    dbName: dbname,
  };
}

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
console.log("[PATCH] /api/leagues/%s env", key, envFingerprint());


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

    // Players/picks may be omitted; only act if present & valid
    const incomingPlayersRaw = Array.isArray(body?.players) ? body.players.slice(0, 5) : null;
    const incomingPicksRaw   = Array.isArray(body?.picks)   ? body.picks               : null;

    const incomingPlayers = incomingPlayersRaw?.map((p: any, i: number) => ({
      id: typeof p?.id === "string" ? p.id : undefined,
      name: (p?.name || `Player ${i + 1}`).toString().slice(0, 80),
      order: i,
      userId: p?.userId ?? null,
    })) ?? [];

    const incomingPicks: Array<{ teamId: string; playerId: string; pickNumber: number }> =
      incomingPicksRaw?.map((p: any) => ({
        teamId: String(p.teamId),
        playerId: String(p.playerId),
        pickNumber: Number(p.pickNumber) || 0,
      })) ?? [];

    const incomingWins = (body?.teamWins && typeof body.teamWins === "object")
      ? (body.teamWins as Record<string, number>)
      : null;

    // 🔒 Heuristic: detect bootstrap/empty autosave & skip destructive writes
    let skipPlayersAndPicks = false;
    if (incomingPlayersRaw) {
      const looksBootstrap =
        incomingPlayers.length > 0 &&
        incomingPlayers.every((p: any, i: number) => !p.id && p.name === `Player ${i + 1}`);
      if (looksBootstrap) {
        skipPlayersAndPicks = true;
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      // League meta (non-destructive)
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

      // Players (only if provided AND not bootstrap)
      let idMap = new Map<string, string>();
      if (!skipPlayersAndPicks && incomingPlayersRaw && incomingPlayers.length > 0) {
        await tx.player.deleteMany({ where: { leagueId } });

        // Use create() in a loop so we get IDs reliably for mapping
        for (const p of incomingPlayers) {
          const created = await tx.player.create({
            data: { leagueId, name: p.name, order: p.order, userId: p.userId },
            select: { id: true, order: true },
          });
          idMap.set(p.id ?? `__idx_${p.order}`, created.id);
        }
      }

      // Picks (only if provided AND not bootstrap)
      if (!skipPlayersAndPicks && incomingPicksRaw && incomingPicks.length > 0) {
        // Remap playerIds if needed (when payload used temp IDs)
        const remapped = incomingPicks.map((p) => {
          const mappedId = idMap.get(p.playerId) ?? p.playerId;
          if (!mappedId) throw new Error(`Could not remap playerId: ${p.playerId}`);
          return { ...p, playerId: mappedId };
        });

        // Validate: all playerIds belong to this league
        const playerIds = [...new Set(remapped.map((p) => p.playerId))];
        if (playerIds.length) {
          const owners = await tx.player.findMany({
            where: { id: { in: playerIds } },
            select: { id: true, leagueId: true },
          });
          const badIds = new Set(owners.filter(o => o.leagueId !== leagueId).map(o => o.id));
          if (badIds.size) {
            throw new Error(`Invalid picks: player(s) not in league: ${[...badIds].join(",")}`);
          }
        }

        await tx.pick.deleteMany({ where: { leagueId } });
        await tx.pick.createMany({
          data: remapped.map((p) => ({ ...p, leagueId })),
        });
      }

      // 🏆 Wins: use UPSERT so rows are created if missing
      if (incomingWins) {
        for (const [teamId, wins] of Object.entries(incomingWins)) {
          const val = Number.isFinite(+wins) ? Math.max(0, Math.min(20, +wins)) : 0;
          await tx.teamWin.upsert({
            where: { leagueId_teamId: { leagueId, teamId } },
            update: { wins: val },
            create: { leagueId, teamId, wins: val },
          });
        }
      }

      return {
        ok: true,
        updatedLeagueId: leagueId,
        playersAction: (!skipPlayersAndPicks && incomingPlayersRaw) ? "replaced" : "preserved",
        picksAction:   (!skipPlayersAndPicks && incomingPicksRaw)   ? "replaced" : "preserved",
        winsAction: !!incomingWins ? "upserted" : "skipped",
      };
    });

       console.log("[PATCH] done", { key, result, env: envFingerprint() });
    return NextResponse.json({ ...result, env: envFingerprint() });
  } catch (err: any) {
    console.error("[PATCH /api/leagues/:id] error", {
      key,
      body,
      message: err?.message,
      stack: err?.stack,
      env: envFingerprint(),
    });
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Internal server error", env: envFingerprint() },
      { status: 400 }
    );
  }
}