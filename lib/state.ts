// lib/state.ts
import { NFL_TEAMS } from "@/data/teams";

export type Player = { id: string; name: string };
export type Pick = { teamId: string; playerId: string; pickNumber: number };

export type PoolState = {
  leagueName: string;
  players: Player[];
  teamsPerPlayer: number;
  picks: Pick[];
  snake: boolean; // kept for fallback behavior
  teamWins: Record<string, number>;
};

export const STORAGE_KEY = "wins-pool-2025-v1";

/**
 * Custom draft order (hardcoded) — by overall pickNumber → player slot (1..5).
 * Slot 1 corresponds to players[0], slot 2 → players[1], etc.
 */
export const CUSTOM_DRAFT_ORDER: Record<number, 1 | 2 | 3 | 4 | 5> = {
  // Player 1
  1: 1, 10: 1, 12: 1, 20: 1, 24: 1, 26: 1,
  // Player 2
  2: 2, 9: 2, 14: 2, 16: 2, 23: 2, 29: 2,
  // Player 3
  3: 3, 8: 3, 13: 3, 17: 3, 22: 3, 30: 3,
  // Player 4
  4: 4, 7: 4, 11: 4, 18: 4, 25: 4, 28: 4,
  // Player 5
  5: 5, 6: 5, 15: 5, 19: 5, 21: 5, 27: 5,
};

/** Convenience: get the player slot (1..5) for a given overall pick number. */
export function getPlayerSlotForPick(pickNumber: number): 1 | 2 | 3 | 4 | 5 | undefined {
  return CUSTOM_DRAFT_ORDER[pickNumber];
}

/** Map pickNumber → actual Player (from `players`) using the custom order. */
export function getPlayerForPick(players: Player[], pickNumber: number): Player | null {
  // Only valid for the 5-player custom draft
  if (players.length !== 5) return null;
  const slot = getPlayerSlotForPick(pickNumber);
  if (!slot) return null;
  // slot 1 → index 0, slot 2 → index 1, etc.
  return players[slot - 1] ?? null;
}

export function defaultPlayers(): Player[] {
  return [
    { id: "P1", name: "Player 1" },
    { id: "P2", name: "Player 2" },
    { id: "P3", name: "Player 3" },
    { id: "P4", name: "Player 4" },
    { id: "P5", name: "Player 5" },
  ];
}

export function defaultState(): PoolState {
  return {
    leagueName: "2025 NFL Wins Pool",
    players: defaultPlayers(),
    teamsPerPlayer: 6,
    picks: [],
    // Keep true so your old logic still works if the league isn’t 5 players.
    // computeDraftTurn prefers CUSTOM_DRAFT_ORDER when players.length === 5.
    snake: true,
    teamWins: Object.fromEntries(NFL_TEAMS.map((t) => [t.id, 0])) as Record<string, number>,
  };
}

export function saveState(state: PoolState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export function loadState(): PoolState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PoolState;
  } catch {
    return null;
  }
}

/**
 * Compute whose turn it is.
 * - If exactly 5 players → uses CUSTOM_DRAFT_ORDER (hardcoded mapping)
 * - Otherwise → falls back to snake logic.
 */
export function computeDraftTurn(players: Player[], picks: Pick[], snake: boolean) {
  const totalPicksSoFar = picks.length;
  const nextPickNumber = totalPicksSoFar + 1;

  // Prefer custom mapping when we have the 5-player league
  if (players.length === 5) {
    const current = getPlayerForPick(players, nextPickNumber);
    // Build the visible order row for this "round" (just the players in slot order 1..5)
    const order = [players[0], players[1], players[2], players[3], players[4]];
    // Round is just a user-facing label here; compute roughly from pickNumber (ceil / 5)
    const round = Math.ceil(nextPickNumber / 5);
    return { round, current, order };
  }

  // Fallback: original snake logic for other player counts
  const totalPerRound = players.length;
  const roundIndex = Math.floor(totalPicksSoFar / totalPerRound); // 0-based
  const indexInRound = totalPicksSoFar % totalPerRound;
  const order = snake && roundIndex % 2 === 1 ? [...players].reverse() : players;
  const current = order[indexInRound] || null;
  return { round: roundIndex + 1, current, order };
}
