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
  const key = process.env.DEFAULT_LEAGUE_KEY; // server component is fine
  return (
    <nav className="flex gap-4 p-4 border-b">
      <Link href="/">Home</Link>
      {key && (
        <>
          <Link href={`/league/${encodeURIComponent(key)}/players`}>Players</Link>
          <Link href={`/league/${encodeURIComponent(key)}/draft`}>Draft</Link>
          <Link href={`/league/${encodeURIComponent(key)}/results`}>Results</Link>
        </>
      )}
    </nav>
  );
}

