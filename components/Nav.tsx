// components/Nav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Nav({ leagueId }: { leagueId: string }) {
  const pathname = usePathname();

  const links = [
    { href: `/league/${leagueId}/players`, label: "Players" },
    { href: `/league/${leagueId}/draft`, label: "Draft" },
    { href: `/league/${leagueId}/results`, label: "Results" },
  ];

  return (
    <nav className="flex gap-6 border-b pb-2 mb-4">
      {links.map((link) => {
        const isActive = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`${
              isActive ? "font-bold border-b-2 border-blue-500" : "text-gray-600"
            } pb-1`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
