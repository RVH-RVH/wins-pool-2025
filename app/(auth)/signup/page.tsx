"use client";
import { useState } from "react";
import Link from "next/link";

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(()=>({}));
      setError(body?.error || "Failed to sign up");
      return;
    }
    setOk(true);
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-2xl shadow border p-6">
        <h1 className="text-2xl font-semibold mb-4">Create account</h1>
        {ok ? (
          <div className="text-green-700">
            Account created. You can now <Link href="/signin" className="underline">sign in</Link>.
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-3">
            <input className="w-full border rounded-lg px-3 py-2" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
            <input className="w-full border rounded-lg px-3 py-2" placeholder="Name (optional)" value={name} onChange={e=>setName(e.target.value)} />
            <input className="w-full border rounded-lg px-3 py-2" type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} />
            {error && <div className="text-sm text-red-600">{error}</div>}
            <button disabled={loading} className="w-full px-4 py-2 bg-slate-900 text-white rounded-lg">
              {loading ? "Creating..." : "Create account"}
            </button>
          </form>
        )}
        <div className="text-sm text-slate-600 mt-3">
          Already have an account? <Link href="/signin" className="underline">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
