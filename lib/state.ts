import { NFL_TEAMS } from "@/data/teams";

export type Player = { id: string; name: string };
export type Pick = { teamId: string; playerId: string; pickNumber: number };

export type PoolState = {
  leagueName: string;
  players: Player[];
  teamsPerPlayer: number;
  picks: Pick[];
  snake: boolean;
  teamWins: Record<string, number>;
};

export const STORAGE_KEY = "wins-pool-2025-v1";

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
    snake: true,
    teamWins: Object.fromEntries(NFL_TEAMS.map(t => [t.id, 0])) as Record<string, number>,
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

export function computeDraftTurn(players: Player[], picks: Pick[], snake: boolean) {
  const totalPerRound = players.length;
  const totalPicks = picks.length;
  const round = Math.floor(totalPicks / totalPerRound); // 0-index
  const indexInRound = totalPicks % totalPerRound;
  const order = snake && round % 2 === 1 ? [...players].reverse() : players;
  const current = order[indexInRound] || null;
  return { round: round + 1, current, order };
}
