"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

function useLeagueBase() {
  const pathname = usePathname() || "";
  // If we're inside /league/<id>/..., capture that base.
  const m = pathname.match(/^\/league\/([^/]+)/);
  return m ? `/league/${m[1]}` : "";
}

export default function TopNav() {
  const base = useLeagueBase();
  const link = (p: string) => (base ? `${base}${p}` : p);

  return (
    <nav className="flex gap-2">
      <Link className="px-3 py-1.5 rounded-xl bg-slate-900 text-white" href={link("/draft")}>Draft</Link>
      <Link className="px-3 py-1.5 rounded-xl bg-slate-100 border" href={link("/results")}>Results</Link>
      <Link className="px-3 py-1.5 rounded-xl bg-slate-100 border" href={link("/players")}>Players</Link>
    </nav>
  );
}

