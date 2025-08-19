"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function SubNav() {
  const pathname = usePathname() || "";
  const m = pathname.match(/^\/league\/([^/]+)/);
  const base = m ? `/league/${m[1]}` : "";
  const link = (p: string) => (base ? `${base}${p}` : p);

  return (
    <div className="flex gap-2 mb-4">
      <Link href={link("/draft")} className="px-3 py-2 rounded-xl border shadow">Draft</Link>
      <Link href={link("/results")} className="px-3 py-2 rounded-xl border shadow">Results</Link>
      <Link href={link("/players")} className="px-3 py-2 rounded-xl border shadow">Players</Link>
    </div>
  );
}
