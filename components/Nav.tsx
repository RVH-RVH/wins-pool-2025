// components/Nav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Nav({ leagueKey }: { leagueKey: string }) {
  const pathname = usePathname();
  const K = encodeURIComponent(leagueKey);
  const items = [
    { href: `/league/${K}/players`, label: "Players" },
    { href: `/league/${K}/draft`,   label: "Draft" },
    { href: `/league/${K}/results`, label: "Results" },
  ];

  return (
    <nav className="flex gap-3 border-b pb-2">
      {items.map((it) => {
        const active = pathname === it.href;
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`px-3 py-1 rounded ${
              active ? "bg-blue-600 text-white" : "text-blue-600 hover:bg-blue-100"
            }`}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
