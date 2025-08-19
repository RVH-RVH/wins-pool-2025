"use client";
import { useState } from "react";

export default function AdminBar() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function syncNow() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/sync-wins/ui", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ season: new Date().getFullYear() }) // optional
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(`Error: ${data?.error || res.status}`);
      } else if (data?.dryRun) {
        setMsg(`Dry run OK — ${data.count ?? 0} updates`);
      } else {
        setMsg(`Synced — ${data.count ?? 0} updates`);
      }
    } catch (e: any) {
      setMsg(`Request failed: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="my-4 flex items-center gap-3 rounded-xl border bg-white p-3 shadow">
      <button
        onClick={syncNow}
        disabled={busy}
        className="px-3 py-2 rounded-xl bg-slate-900 text-white disabled:opacity-60"
      >
        {busy ? "Syncing…" : "Sync Wins Now"}
      </button>
      <span className="text-sm text-slate-600">
        {msg ?? "Admin only · uses ESPN by default"}
      </span>
    </div>
  );
}
