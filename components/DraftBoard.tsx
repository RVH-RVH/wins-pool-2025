"use client";
import { useMemo, useRef, useState } from "react";
import { NFL_TEAMS } from "@/data/teams";
import { computeDraftTurn, type Player } from "@/lib/state";
import { usePool } from "@/lib/usePool";

function teamLabel(t: {city: string, name: string}) { return `${t.city} ${t.name}`; }

export default function DraftBoard() {
  const { state, setState } = usePool();
  const [filter, setFilter] = useState("");
  const totalDraftPicks = state.players.length * state.teamsPerPlayer;
  const draftInfo = computeDraftTurn(state.players, state.picks, state.snake);
  const draftComplete = state.picks.length >= totalDraftPicks;
  const takenTeamIds = new Set(state.picks.map(p => p.teamId));
  const picksByPlayer = useMemo(() => {
    const m = new Map<string, {teamId: string, pickNumber: number}[]>();
    for (const pl of state.players) m.set(pl.id, []);
    for (const p of state.picks) {
      if (!m.has(p.playerId)) m.set(p.playerId, []);
      m.get(p.playerId)!.push({ teamId: p.teamId, pickNumber: p.pickNumber });
    }
    return m;
  }, [state.picks, state.players]);

  function renamePlayer(id: string, name: string) {
    setState(s => ({ ...s, players: s.players.map(p => p.id === id ? { ...p, name: name || p.name } : p) }));
  }
  function makePick(teamId: string) {
    if (draftComplete || takenTeamIds.has(teamId)) return;
    const current = draftInfo.current as Player | null;
    if (!current) return;
    const myCount = (picksByPlayer.get(current.id) ?? []).length;
    if (myCount >= state.teamsPerPlayer) return;
    const pickNumber = state.picks.length + 1;
    setState(s => ({ ...s, picks: [...s.picks, { teamId, playerId: current.id, pickNumber }] }));
  }
  function undoPick() {
    setState(s => ({ ...s, picks: s.picks.slice(0, -1) }));
  }

  const availableTeams = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return NFL_TEAMS.filter(t => !takenTeamIds.has(t.id) && (!q || t.id.toLowerCase().includes(q) || t.name.toLowerCase().includes(q) || t.city.toLowerCase().includes(q)));
  }, [filter, state.picks]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Draft</h2>
        <div className="flex gap-2">
          <button onClick={() => setState(s => ({ ...s, snake: !s.snake }))} className="px-3 py-2 rounded-xl bg-white shadow hover:shadow-md border">
            {state.snake ? "Snake: On" : "Snake: Off"}
          </button>
          <button onClick={undoPick} disabled={state.picks.length === 0} className="px-3 py-2 rounded-xl bg-white shadow hover:shadow-md border">Undo</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Status */}
        <div className="bg-white rounded-2xl shadow border p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm">Round <span className="font-semibold">{draftInfo.round}</span></div>
            <span className="text-sm text-slate-500">{state.picks.length}/{totalDraftPicks} picks</span>
          </div>
          {!draftComplete ? (
            <div className="space-y-2">
              <div className="text-sm">On the clock: <span className="font-semibold">{draftInfo.current?.name ?? "—"}</span></div>
              <div className="flex flex-wrap gap-1 text-xs mt-2">
                {draftInfo.order.map(p => (
                  <span key={p.id} className={`px-2 py-1 rounded-full border ${p.id === draftInfo.current?.id ? "bg-slate-900 text-white" : "bg-slate-100"}`}>
                    {p.name}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-sm font-medium text-green-700">Draft complete ✔️</div>
          )}
        </div>

        {/* Available Teams */}
        <div className="bg-white rounded-2xl shadow border p-4 lg:col-span-2">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className="font-semibold">Available Teams</h3>
            <input
              placeholder="Search team..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-50 border w-48"
            />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
            {availableTeams.map(t => (
              <button key={t.id} onClick={() => makePick(t.id)} disabled={draftComplete}
                className="text-left p-3 rounded-2xl border shadow-sm bg-white hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed">
                <div className="text-xs text-slate-500">{t.id}</div>
                <div className="font-medium">{teamLabel(t)}</div>
                <div className="text-xs text-slate-500 mt-1">Click to draft</div>
              </button>
            ))}
            {availableTeams.length === 0 && <div className="text-sm text-slate-500 col-span-full">No teams match your search.</div>}
          </div>
        </div>

        {/* Rosters */}
        <div className="bg-white rounded-2xl shadow border p-4 lg:col-span-3">
          <h3 className="font-semibold mb-2">Rosters</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {state.players.map(pl => {
              const picks = (picksByPlayer.get(pl.id) ?? []).map(p => p.teamId);
              return (
                <div key={pl.id} className="border rounded-xl p-3 bg-slate-50">
                  <div className="flex items-center justify-between">
                    <input
                      value={pl.name}
                      onChange={(e) => renamePlayer(pl.id, e.target.value)}
                      className="font-medium bg-transparent focus:outline-none border-b border-transparent focus:border-slate-300"
                    />
                    <div className="text-xs text-slate-500">{picks.length}/{state.teamsPerPlayer}</div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {picks.map(tid => <span key={tid} className="text-xs px-2 py-1 rounded-full bg-white border">{tid}</span>)}
                    {picks.length === 0 && <div className="text-xs text-slate-500">No picks yet</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
