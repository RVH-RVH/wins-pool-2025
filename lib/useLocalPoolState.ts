"use client";

import { useEffect, useMemo, useState } from "react";
import { loadState, saveState, defaultState, type PoolState, type Player, type Pick } from "./state";
import { NFL_TEAMS, type Team } from "@/data/teams";

export function useLocalPoolState() {
  const [state, setState] = useState<PoolState>(() => loadState() ?? defaultState());

  useEffect(() => {
    saveState(state);
  }, [state]);

  const teamMap = useMemo<Record<string, Team>>(() => Object.fromEntries(NFL_TEAMS.map(t => [t.id, t])), []);
  const takenTeamIds = useMemo(() => new Set(state.picks.map(p => p.teamId)), [state.picks]);

  return { state, setState, teamMap, takenTeamIds };
}
