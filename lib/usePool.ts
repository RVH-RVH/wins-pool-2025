"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { defaultState, loadState, saveState, type PoolState } from "@/lib/state";
import { NFL_TEAMS } from "@/data/teams";
import { useParams } from "next/navigation";

async function fetchLeague(leagueId: string) {
  const res = await fetch(`/api/leagues/${leagueId}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load league");
  return res.json() as Promise<{
    league: { id: string; name: string; teamsPerPlayer: number; snake: boolean };
    players: { id: string; name: string; order: number; userId?: string | null }[];
    picks: { id: string; teamId: string; playerId: string; pickNumber: number }[];
    teamWins: Record<string, number>;
  }>;
}

async function saveLeague(leagueId: string, payload: any) {
  const res = await fetch(`/api/leagues/${leagueId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to save league");
  return res.json();
}

export function usePool() {
  const params = useParams();
  const leagueId = (params as any)?.leagueId as string | undefined;
  const isServerMode = Boolean(leagueId);

  const [state, setState] = useState<PoolState>(() => defaultState());
  const [playerIds, setPlayerIds] = useState<string[]>([]);
 const [hydrated, setHydrated] = useState(false);
const [bootstrapped, setBootstrapped] = useState(false);
const suppressSaveRef = useRef(false);
  const savingRef = useRef(false);
// load from server
useEffect(() => {
  if (!isServerMode) return;
  let ignore = false;
  suppressSaveRef.current = true;
  fetchLeague(leagueId!).then((data) => {
    if (ignore) return;
    const sorted = [...data.players].sort((a,b) => a.order - b.order);
    const newState: PoolState = {
      leagueName: data.league.name,
      players: sorted.map((p, i) => ({ id: `P${i+1}`, name: p.name })),
      teamsPerPlayer: data.league.teamsPerPlayer,
      picks: data.picks.map(p => ({ teamId: p.teamId, playerId: mapPlayerId(sorted, p.playerId), pickNumber: p.pickNumber })),
      snake: data.league.snake,
      teamWins: fillWins(data.teamWins),
    };
    setState(newState);
    setPlayerIds(sorted.map(p => p.id));
  }).catch(console.error).finally(() => {
    suppressSaveRef.current = false;
    setBootstrapped(true);
  });
  return () => { ignore = true; };
}, [isServerMode, leagueId]);

// SSE: suppress autosave while applying server-pushed changes
useEffect(() => {
  if (!isServerMode || !leagueId) return;
  const es = new EventSource(`/api/leagues/${leagueId}/events`);
  let timer: any;
  es.onmessage = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      suppressSaveRef.current = true;
      fetchLeague(leagueId).then(data => {
        const sorted = [...data.players].sort((a,b) => a.order - b.order);
        const newState: PoolState = {
          leagueName: data.league.name,
          players: sorted.map((p, i) => ({ id: `P${i+1}`, name: p.name })),
          teamsPerPlayer: data.league.teamsPerPlayer,
          picks: data.picks.map(p => ({ teamId: p.teamId, playerId: mapPlayerId(sorted, p.playerId), pickNumber: p.pickNumber })),
          snake: data.league.snake,
          teamWins: fillWins(data.teamWins),
        };
        setState(newState);
        setPlayerIds(sorted.map(p => p.id));
      }).catch(console.error).finally(() => {
        // small delay so dependent effects settle before autosave can run
        setTimeout(() => { suppressSaveRef.current = false; }, 50);
      });
    }, 250);
  };
  es.onerror = () => {};
  return () => { try { es.close(); } catch {} };
}, [isServerMode, leagueId]);

// AUTOSAVE: only after bootstrapped, and never while suppressed
useEffect(() => {
  if (!isServerMode) return;
  if (!bootstrapped) return;
  if (suppressSaveRef.current) return;
  // also: don't autosave if we don't have player row IDs yet
  if (playerIds.length === 0 || state.players.length === 0) return;

  const t = setTimeout(() => {
    if (suppressSaveRef.current) return;
    if (savingRef.current) return;
    savingRef.current = true;
    const payload = serializeForServer(state, playerIds);
    saveLeague(leagueId!, payload).catch(console.error).finally(() => { savingRef.current = false; });
  }, 600);
  return () => clearTimeout(t);
}, [isServerMode, leagueId, state, playerIds, bootstrapped]);
// Local mode: persist to localStorage
useEffect(() => {
  if (!isServerMode) saveState(state);
}, [isServerMode, state]);
  // Save to server on state changes (debounced)
  useEffect(() => {
    if (!isServerMode) return;
    const t = setTimeout(() => {
      if (savingRef.current) return;
      savingRef.current = true;
      const payload = serializeForServer(state, playerIds);
      saveLeague(leagueId!, payload).catch(console.error).finally(() => { savingRef.current = false; });
    }, 600);
    return () => clearTimeout(t);
  }, [isServerMode, leagueId, state, playerIds]);

  const teamMap = useMemo(() => Object.fromEntries(NFL_TEAMS.map(t => [t.id, t])), []);
  const takenTeamIds = useMemo(() => new Set(state.picks.map(p => p.teamId)), [state.picks]);
  return { state, setState, teamMap, takenTeamIds };
}

function fillWins(serverWins: Record<string, number>) {
  const base = Object.fromEntries(NFL_TEAMS.map(t => [t.id, 0])) as Record<string, number>;
  for (const [k, v] of Object.entries(serverWins)) base[k] = v ?? 0;
  return base;
}

function mapPlayerId(sortedPlayers: {id: string}[], playerId: string) {
  const idx = sortedPlayers.findIndex(p => p.id === playerId);
  return idx >= 0 ? `P${idx+1}` : "P1";
}

function serializeForServer(state: PoolState, playerRowIds: string[]) {
  // players by order
  const players = state.players.map((p, i) => ({
    name: p.name, order: i, id: playerRowIds[i] ?? undefined
  }));
  // picks need mapping from P# -> db player id
  const map = new Map<string, string>();
  state.players.forEach((_, i) => map.set(`P${i+1}`, playerRowIds[i] ?? ""));
  const picks = state.picks.map(p => ({
    teamId: p.teamId, playerId: map.get(p.playerId) || playerRowIds[0], pickNumber: p.pickNumber
  }));
  return {
    leagueName: state.leagueName,
    teamsPerPlayer: state.teamsPerPlayer,
    snake: state.snake,
    players,
    picks,
    teamWins: state.teamWins,
  };
}
