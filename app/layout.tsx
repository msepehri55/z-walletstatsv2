import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "ZenChain — Wallet Insights",
  description: "Explorer-direct wallet analytics: fast, accurate, complete."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="sticky top-0 z-40 bg-gradient-to-b from-black/60 to-transparent backdrop-blur border-b border-white/5">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
            <img src="/zenchain-logo.png" alt="ZenChain" className="h-7 w-7 rounded-md" />
            <Link href="/" className="text-sm font-semibold tracking-wide">
              ZenChain — Wallet Insights
            </Link>
            <div className="ml-auto">
              <Link href="/admin" className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 text-xs">
                Admin
              </Link>
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 py-5">{children}</main>
        <footer className="max-w-7xl mx-auto px-4 py-8 text-xs text-zen-sub">
          © {new Date().getFullYear()} ZenStats
        </footer>
      </body>
    </html>
  );
}