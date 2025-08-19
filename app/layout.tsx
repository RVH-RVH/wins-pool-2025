import { AppSessionProvider, UserMenu } from "@/components/AuthKit";
import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import TopNav from "@/components/TopNav";             

export const metadata: Metadata = {
  title: "2025 NFL Wins Pool",
  description: "Snake draft wins pool for the 2025 NFL season",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="border-b bg-white">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/" className="text-xl font-bold">2025 NFL Wins Pool</Link>
                           <TopNav />
          </div>
        </header>
        {/* Auth session provider */}
        <AppSessionProvider>
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-end"><UserMenu /></div>
        <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
        </AppSessionProvider>
        <footer className="text-center text-xs text-slate-500 py-8">
          Built for 5×6 snake draft. Data stored in your browser.
        </footer>
      </body>
    </html>
  );
}
