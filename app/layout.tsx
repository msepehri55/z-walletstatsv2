import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "Zenchian Testnet — Wallet Stats",
  description: "Ultra-fast wallet activity explorer with accurate categorization."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="sticky top-0 z-50 bg-gradient-to-b from-black/40 to-transparent backdrop-blur border-b border-white/5">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
            <img src="/zen.svg" alt="Zen" width={24} height={24} className="h-6 w-6" />
            <Link href="/" className="text-lg font-semibold tracking-wide">
              Zenchian Testnet — Wallet Stats
            </Link>
            <div className="flex-1" />
            <Link href="/admin" className="text-zen-sub hover:text-white">Admin</Link>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
        <footer className="max-w-7xl mx-auto px-4 py-8 text-sm text-zen-sub">© {new Date().getFullYear()} ZenStats</footer>
      </body>
    </html>
  );
}