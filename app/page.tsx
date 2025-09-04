// app/page.tsx — Server Component
import AdminBarGate from "@/components/AdminBar";
import HomeLanding from "@/components/HomeLanding";

export const metadata = {
  title: "2025 NFL Wins Pool",
  description: "Create or join a wins pool league with friendly codes",
};

export default async function HomePage() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        {/* Admin-only: shows "Sync Wins Now" button (if your email is in ADMIN_EMAILS) */}
        <AdminBarGate />

        {/* Main landing actions (create / join) */}
        <HomeLanding />
      </div>
    </div>
  );
}

