"use client";
import { SessionProvider, signIn, signOut, useSession } from "next-auth/react";

export function AppSessionProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}

export function UserMenu() {
  const { data: session, status } = useSession();
  if (status === "loading") return <div className="text-sm text-slate-500">...</div>;
  if (!session) {
    return (
      <div className="flex items-center gap-2">
        <button onClick={() => signIn("github")} className="px-3 py-1.5 rounded-xl bg-slate-100 border">GitHub</button>
        <a href="/signin" className="px-3 py-1.5 rounded-xl bg-slate-100 border">Sign in</a>
        <a href="/signup" className="px-3 py-1.5 rounded-xl bg-slate-100 border">Sign up</a>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-slate-600">Hi, {session.user?.name ?? session.user?.email ?? "user"}</span>
      <button onClick={() => signOut()} className="px-3 py-1.5 rounded-xl bg-slate-100 border">Sign out</button>
    </div>
  );
}

