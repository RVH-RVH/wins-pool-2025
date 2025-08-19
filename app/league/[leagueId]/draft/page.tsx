import DraftBoard from "@/components/DraftBoard";

export default function LeagueDraftPage() {
  return (
    <div className="space-y-2">
      <LeagueCodeBanner />
      <DraftBoard />
    </div>
  );
}

async function getLeagueMeta(id: string) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/leagues/${id}`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

function LeagueCodeBanner() {
  // Lightweight client fetch could also be done if you prefer
  return null; // keep it simple for now; or add a client component to show code
}
