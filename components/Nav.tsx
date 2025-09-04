"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface LeagueNavProps {
  leagueId: string;
  leagueCode?: string | null;
}

const tabs = [
  { slug: "players", label: "Players" },
  { slug: "draft", label: "Draft" },
  { slug: "results", label: "Results" },
];

export default function LeagueNav({ leagueId, leagueCode }: LeagueNavProps) {
  const pathname = usePathname();
  // Use code if it exists, otherwise fallback to id
  const key = leagueCode ?? leagueId;

  

  return (
    <nav className="flex space-x-4 border-b pb-2">
      {tabs.map((tab) => {
        const href = `/league/${encodeURIComponent(key)}/${tab.slug}`;
        const isActive = pathname === href;
        return (
          <Link
            key={tab.slug}
            href={href}
            className={`px-3 py-1 rounded ${
              isActive ? "bg-blue-600 text-white" : "text-blue-600 hover:bg-blue-100"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}