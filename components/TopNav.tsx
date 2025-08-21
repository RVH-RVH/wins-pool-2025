// components/TopNav.tsx
import Link from "next/link";

export default function TopNav() {
  const key = process.env.DEFAULT_LEAGUE_KEY ?? null; // optional

  return (
    <nav className="flex items-center gap-3 border-b px-4 py-3 bg-white">
      <Link href="/" className="font-semibold">Home</Link>
      {key && (
        <>
          <Link
            href={`/league/${encodeURIComponent(key)}/draft`}
            className="px-3 py-1 rounded bg-slate-900 text-white"
          >
            Draft
          </Link>
          <Link
            href={`/league/${encodeURIComponent(key)}/results`}
            className="px-3 py-1 rounded border"
          >
            Results
          </Link>
        </>
      )}
    </nav>
  );
}


