"use client";
import { useSession } from "next-auth/react";
import { usePool } from "@/lib/usePool";

export default function PlayersManager() {
  const { data: session } = useSession();
  const { state, setState } = usePool();

  const userId =
    (session?.user as any)?.email || session?.user?.name || (session?.user as any)?.id;
  const CLAIM_KEY = "wins-pool-claims";
  const claims =
    typeof window !== "undefined"
      ? (JSON.parse(localStorage.getItem(CLAIM_KEY) || "{}") as Record<string, string>)
      : {};

  function saveClaims(next: Record<string, string>) {
    localStorage.setItem(CLAIM_KEY, JSON.stringify(next));
  }
  function claimSlot(idx: number) {
    if (!userId) {
      alert("Sign in to claim a slot.");
      return;
    }
    const next = { ...claims };
    for (const k of Object.keys(next)) if (next[k] === userId) delete next[k];
    next[String(idx)] = userId;
    saveClaims(next);
    alert(`Claimed slot ${idx + 1} for ${session?.user?.name || userId}`);
  }
  function unclaimSlot(idx: number) {
    const next = { ...claims };
    delete next[String(idx)];
    saveClaims(next);
  }

  function updateName(idx: number, val: string) {
    setState((s) => ({
      ...s,
      players: s.players.map((p, i) => (i === idx ? { ...p, name: val } : p)),
    }));
  }

  function move(idx: number, dir: -1 | 1) {
    setState((s) => {
      const arr = [...s.players];
      const j = idx + dir;
      if (j < 0 || j >= arr.length) return s;
      [arr[idx], arr[j]] = [arr[j], arr[idx]];
      return { ...s, players: arr };
    });
  }

  function shuffle() {
    setState((s) => {
      const arr = [...s.players];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return { ...s, players: arr };
    });
  }

  function resetPicks() {
    if (!confirm("Reset all draft picks?")) return;
    setState((s) => ({ ...s, picks: [] }));
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow border p-4">
        <h2 className="text-lg font-semibold mb-2">Assign Players</h2>
        <p className="text-sm text-slate-600 mb-4">
          Rename players and set draft order. Changes auto-save.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {state.players.map((p, i) => (
            <div key={p.id || i} className="flex items-center gap-2 border rounded-xl p-3 bg-slate-50">
              <span className="w-6 text-sm text-slate-500">{i + 1}.</span>
              <input
                value={p.name}
                onChange={(e) => updateName(i, e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg border bg-white"
                placeholder={`Player ${i + 1}`}
              />
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => move(i, -1)}
                  className="text-xs px-2 py-1 rounded border bg-white disabled:opacity-40"
                  disabled={i === 0}
                >
                  ↑
                </button>
                <button
                  onClick={() => move(i, 1)}
                  className="text-xs px-2 py-1 rounded border bg-white disabled:opacity-40"
                  disabled={i === state.players.length - 1}
                >
                  ↓
                </button>
              </div>
              <div className="flex flex-col gap-1 ml-2">
                <button onClick={() => claimSlot(i)} className="text-xs px-2 py-1 rounded border bg-white">
                  Claim
                </button>
                <button onClick={() => unclaimSlot(i)} className="text-xs px-2 py-1 rounded border bg-white">
                  Unclaim
                </button>
                <span className="text-[10px] text-slate-500 mt-1">
                  {claims[String(i)] ? "Claimed" : "Unclaimed"}
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={shuffle} className="px-3 py-2 rounded-xl bg-white border shadow">
            Shuffle Order
          </button>
          <button onClick={resetPicks} className="px-3 py-2 rounded-xl bg-white border shadow">
            Reset Draft Picks
          </button>
        </div>
      </div>
    </div>
  );
}
