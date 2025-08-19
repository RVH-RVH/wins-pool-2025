"use client";
import { useMemo } from "react";
import { NFL_TEAMS } from "@/data/teams";
import { usePool } from "@/lib/usePool";

export default function Results() {
  const { state, setState } = usePool();
  const picksByPlayer = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const p of state.picks) {
      if (!m.has(p.playerId)) m.set(p.playerId, []);
      m.get(p.playerId)!.push(p.teamId);
    }
    return m;
  }, [state.picks]);

  const leaderboard = useMemo(() => {
    return state.players.map(pl => {
      const teamIds = picksByPlayer.get(pl.id) ?? [];
      const total = teamIds.reduce((acc, tid) => acc + (state.teamWins[tid] ?? 0), 0);
      return { playerId: pl.id, name: pl.name, total, teamIds };
    }).sort((a,b) => b.total - a.total || a.name.localeCompare(b.name));
  }, [state.players, state.teamWins, picksByPlayer]);

  function setWins(teamId: string, wins: number | string) {
    const val = Math.max(0, Math.min(20, Number.isFinite(+wins) ? +wins : 0));
    setState(s => ({ ...s, teamWins: { ...s.teamWins, [teamId]: val } }));
  }

  return (
    <div className="space-y-6">
      {/* Leaderboard */}
      <div className="bg-white rounded-2xl shadow border p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Leaderboard</h2>
          <div className="text-xs text-slate-500">Totals update as you edit wins</div>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="py-2">#</th>
                <th className="py-2">Player</th>
                <th className="py-2">Wins</th>
                <th className="py-2">Teams</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((row, idx) => (
                <tr key={row.playerId} className="border-b last:border-0">
                  <td className="py-2 pr-2 w-8">{idx + 1}</td>
                  <td className="py-2 pr-2 font-medium">{row.name}</td>
                  <td className="py-2 pr-2 font-semibold">{row.total}</td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-1">
                      {row.teamIds.map(tid => <span key={tid} className="text-xs px-2 py-1 rounded-full bg-slate-100 border">{tid}</span>)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Team Wins Editor */}
      <div className="bg-white rounded-2xl shadow border p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Team Wins Editor</h2>
          <div className="text-xs text-slate-500">Enter current wins per team</div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
          {NFL_TEAMS.map(t => (
            <div key={t.id} className="p-3 rounded-2xl border bg-slate-50">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-500">{t.id}</div>
                  <div className="font-medium">{t.city} {t.name}</div>
                </div>
                <input
                  type="number" min={0} max={20}
                  value={state.teamWins[t.id] ?? 0}
                  onChange={e => setWins(t.id, e.target.value)}
                  className="w-16 px-2 py-1 rounded-lg border bg-white text-right"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
