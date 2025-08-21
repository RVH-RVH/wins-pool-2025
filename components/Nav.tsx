"use client";

import Link from "next/link";

type Props = { leagueId: string };

export default function Nav({ leagueId }: Props) {
  return (
    <nav className="flex gap-4 border-b pb-2 text-sm">
      <Link href={`/league/${leagueId}/draft`} className="hover:underline">
        Draft
      </Link>
      <Link href={`/league/${leagueId}/players`} className="hover:underline">
        Players
      </Link>
      <Link href={`/league/${leagueId}/results`} className="hover:underline">
        Results
      </Link>
    </nav>
  );
}

