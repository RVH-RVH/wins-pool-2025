// app/page.tsx — Server Component
import AdminBarGate from "@/components/AdminBar";
import HomeLanding from "@/components/HomeLanding";
import { redirect } from "next/navigation";

export default function HomePage() {
  const key = process.env.DEFAULT_LEAGUE_KEY;
  if (!key) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold">Wins Pool</h1>
        <p>Set DEFAULT_LEAGUE_KEY in your environment to auto-redirect.</p>
      </div>
    );
  }
  redirect(`/league/${encodeURIComponent(key)}/players`);
}

export const metadata = {
  title: "2025 NFL Wins Pool",
  description: "Create or join a wins pool league with friendly codes",
};



