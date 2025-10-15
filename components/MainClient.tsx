"use client";

import { useCallback, useState } from "react";
import WalletSearchPanel, { SearchParams } from "./WalletSearchPanel";
import StatCard from "./StatCard";
import TxTable from "./TxTable";
import { AddressStats } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";
import { CHAIN } from "@/lib/constants";

export default function MainClient() {
  const [query, setQuery] = useState<SearchParams | null>(null);
  const [data, setData] = useState<AddressStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSearch = useCallback(async (p: SearchParams) => {
    if (!p.address) {
      setError("Please paste a valid 0x address.");
      return;
    }
    setQuery(p);
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const url = `/api/address/stats?address=${encodeURIComponent(p.address)}&from=${p.from}&to=${p.to}`;
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || `HTTP ${res.status}`);
      }
      setData(json);
    } catch (e: any) {
      setError(e?.message || "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }, []);

  const counts = data?.countsByCategoryOut || {};
  const deploysSum = (counts["cc_deploy"] || 0) + (counts["cco_deploy"] || 0);

  return (
    <div className="space-y-6">
      <WalletSearchPanel onSearch={onSearch} />

      {loading && (
        <div className="card p-6">
          <div className="animate-pulse">Loading transactions…</div>
          <div className="text-xs text-zen-sub mt-1">
            We query Explorer (compat + REST v2) with fallbacks so you won’t hit the “0 tx” bug.
          </div>
        </div>
      )}

      {error && (
        <div className="card p-6 border border-rose-600/40">
          <div className="text-rose-400 font-medium">Error: {error}</div>
          <div className="text-zen-sub text-sm mt-1">Double-check the wallet address and time range.</div>
        </div>
      )}

      {data && (
        <>
          <div className="card p-4">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <div>
                <span className="text-zen-sub">Wallet:</span>{" "}
                <span className="font-mono">{data.address}</span>
              </div>
              <div className="text-zen-sub">•</div>
              <div>
                Window: {formatDateTime(data.from)} → {formatDateTime(data.to)}
              </div>
              <div className="text-zen-sub">•</div>
              <div>Counts use Direction: Out (matches Admin)</div>
              <div className="text-zen-sub">•</div>
              <div>
                Source: <span className="uppercase">{data.source}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <StatCard title="Stake Actions" emoji="🪙" value={counts["stake"] || 0} color="text-zen-badge-stake" />
            <StatCard title={`Native Sends (${CHAIN.symbol})`} emoji="📤" value={counts["native_send"] || 0} color="text-zen-badge-native" />
            <StatCard title="NFT Mints" emoji="🖼️" value={counts["nft_mint"] || 0} color="text-zen-badge-nft" />
            <StatCard title="Domain Mints" emoji="🌐" value={counts["domain_mint"] || 0} color="text-zen-badge-domain" />
            <StatCard title="Deploys (CC+CCO)" emoji="🛠️" value={deploysSum} color="text-zen-badge-cc" />
            <StatCard title="On-chain GM" emoji="🌞" value={counts["gm"] || 0} color="text-zen-badge-gm" />
            <StatCard title="Swaps" emoji="🔁" value={counts["swap"] || 0} color="text-zen-badge-swap" />
            <StatCard title="Add Liquidity" emoji="💧+" value={counts["add_liquidity"] || 0} color="text-zen-badge-add" />
            <StatCard title="Remove Liquidity" emoji="💧−" value={counts["remove_liquidity"] || 0} color="text-zen-badge-remove" />
            <StatCard title="Bridged" emoji="🔜" value={"Coming soon"} />
          </div>

          <div className="mt-2 text-xs text-zen-sub">
            Notes: Counts use outgoing external tx only and exactly match Admin page logic.
          </div>

          <div className="mt-2 text-xs text-zen-sub">All Transactions</div>
          <TxTable rows={data.transactions} chainSymbol={CHAIN.symbol} defaultDirection="out" />
        </>
      )}
    </div>
  );
}