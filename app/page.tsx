import MainClient from "@/components/MainClient";

export default function Home() {
  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h1 className="text-2xl font-semibold">Zenchain Testnet — Wallet Stats</h1>
        <p className="text-zen-sub mt-2">
          Paste a wallet and select a time range. We fetch via Explorer + RPC with fallback to ensure no “0 tx” bugs and super fast results.
        </p>
      </div>
      <MainClient />
    </div>
  );
}