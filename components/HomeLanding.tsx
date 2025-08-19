"use client";

import { useState } from "react";
import Link from "next/link";

export default function HomeLanding() {
  const [codeOrId, setCodeOrId] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function createLeague() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/leagues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}), // you can include name/teamsPerPlayer if you expose inputs
      });
      const data = await res.json();
      if (!res.ok || !data?.id) {
        throw new Error(data?.error || `Create failed (${res.status})`);
      }
      window.location.href = `/league/${data.id}/draft`;
    } catch (e: any) {
      setErr(e?.message || "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function joinLeague() {
    const v = codeOrId.trim();
    if (!v) return;

    setBusy(true);
    setErr(null);
    try {
      // Try friendly code first
      const tryCode = await fetch(`/api/leagues/by-code/${encodeURIComponent(v)}`, { cache: "no-store" });
      if (tryCode.ok) {
        const data = await tryCode.json();
        window.location.href = `/league/${data.id}/draft`;
        return;
      }
      // Fallback: treat input as raw ID
      window.location.href = `/league/${v}/draft`;
    } catch (e: any) {
      setErr(e?.message || "Join failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg border p-8 text-center">
      <h1 className="text-3xl font-bold mb-3">2025 NFL Wins Pool</h1>
      <p className="text-slate-600 mb-6">
        Create a shared league or join with a friendly code (e.g., <b>FOX-7QK</b>) or the raw ID.
      </p>

      <div className="flex flex-col gap-3">
        <button
          onClick={createLeague}
          disabled={busy}
          className="px-4 py-3 rounded-xl bg-slate-900 text-white font-semibold shadow hover:shadow-md disabled:opacity-60"
        >
          {busy ? "Working…" : "Create a New League"}
        </button>

        <div className="flex gap-2 items-center">
          <input
            placeholder="Enter League Code or ID"
            value={codeOrId}
            onChange={(e) => setCodeOrId(e.target.value)}
            className="flex-1 px-3 py-3 rounded-xl border bg-slate-50"
          />
          <button
            onClick={joinLeague}
            disabled={!codeOrId || busy}
            className="px-4 py-3 rounded-xl bg-slate-100 border font-semibold shadow hover:shadow-md disabled:opacity-60"
          >
            Join
          </button>
        </div>

        {err && <div className="text-sm text-red-600">{err}</div>}

        <div className="text-sm text-slate-500 mt-4">
          Or continue locally:{" "}
          <Link href="/draft" className="underline">Draft</Link>
          {" · "}
          <Link href="/results" className="underline">Results</Link>
          {" · "}
          <Link href="/players" className="underline">Players</Link>
        </div>
      </div>
    </div>
  );
}

