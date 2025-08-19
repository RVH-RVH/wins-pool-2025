"use client";
import { useState } from "react";

type Player = { id?: string; name: string; order: number; userId?: string | null };

export default function PlayersForm({
  leagueId,
  initialPlayers,
}: {
  leagueId: string;
  initialPlayers: Player[];
}) {
  const [players, setPlayers] = useState<Player[]>(
    // clone & ensure exactly 5 slots 0..4
    Array.from({ length: 5 }, (_, i) => initialPlayers[i] ?? { order: i, name: `Player ${i + 1}` })
  );
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function updateName(i: number, val: string) {
    setPlayers(prev => prev.map((p, idx) => (idx === i ? { ...p, name: val } : p)));
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      // send trimmed names; no placeholder injection here
      const payload = {
        namesTouched: true,
        players: players.map(p => ({ id: p.id, name: p.name.trim(), userId: p.userId ?? null })),
      };

      const res = await fetch(`/api/leagues/${leagueId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Save failed (${res.status})`);

      // use server’s canonical players to replace local state
      if (data?.players) {
        const canonical: Player[] = data.players;
        setPlayers(canonical);
      }
      setMsg("Saved ✓");
    } catch (e: any) {
      setMsg(e?.message || "Save error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Players</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {players.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-14 text-sm text-slate-500">#{i + 1}</span>
            <input
              value={p.name}
              onChange={(e) => updateName(i, e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg border bg-white"
              placeholder={`Player ${i + 1}`}
            />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 rounded-xl bg-slate-900 text-white disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save Names"}
        </button>
        {msg && <span className="text-sm text-slate-600">{msg}</span>}
      </div>
    </div>
  );
}

