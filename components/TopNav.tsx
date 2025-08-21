// components/TopNav.tsx
import Link from "next/link";

export default function TopNav() {
  return (
    <nav className="flex items-center justify-between bg-gray-800 text-white px-6 py-3">
      <Link href="/" className="text-lg font-bold">
        Wins Pool
      </Link>
      <div className="flex gap-4">
        <Link href="/" className="hover:underline">
          Home
        </Link>
        <Link href="/about" className="hover:underline">
          About
        </Link>
      </div>
    </nav>
  );
}



