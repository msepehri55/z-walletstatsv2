"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import WalletSearchPanel, { SearchParams } from "./WalletSearchPanel";
import StatCard from "./StatCard";
import TxTable from "./TxTable";
import { CATEGORY_ORDER, CHAIN } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import { fetchAndClassifyDirect } from "@/lib/directExplorer";

export default function MainClientDirect() {
  const [data, setData] = useState<{ address: string; enriched: any[]; counts: Record<string, number>; from: number; to: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>("");
  const abortRef = useRef<AbortController | null>(null);

  const onSearch = useCallback(async (p: SearchParams) => {
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setErr(null);
    setData(null);
    setProgress("Fetching…");

    try {
      const address = (p.address || "").toLowerCase();
      if (!/^0x[0-9a-f]{40}$/.test(address)) throw new Error("Invalid address");

      const { enriched, counts } = await fetchAndClassifyDirect({
        address,
        from: p.from,
        to: p.to,
        onProgress: (s) => setProgress(s),
        signal: ctrl.signal
      });

      for (const c of CATEGORY_ORDER) counts[c] = counts[c] || 0;
      setData({ address, enriched, counts, from: p.from, to: p.to });
    } catch (e: any) {
      setErr(e?.name === "AbortError" ? "Cancelled" : (e?.message || "Failed to fetch"));
    } finally {
      setLoading(false);
      setProgress("");
      abortRef.current = null;
    }
  }, []);

  const deploysSum = useMemo(() => (data ? (data.counts["cc_deploy"] || 0) + (data.counts["cco_deploy"] || 0) : 0), [data]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="card p-4">
        <div className="flex items-center gap-3">
          <div className="text-lg font-semibold">ZenChain — Wallet Insights</div>
          <div className="ml-auto text-xs text-zen-sub">Explorer-direct • Fast and complete</div>
        </div>
        <div className="mt-3">
          <WalletSearchPanel onSearch={onSearch} />
        </div>
      </div>

      {/* Status */}
      {loading && (
        <div className="card p-4">
          <div className="flex items-center gap-2 text-sm">
            <div className="h-2 w-2 rounded-full bg-zen-accent animate-pulse" />
            <div>{progress}</div>
          </div>
          <button className="mt-3 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-sm" onClick={() => abortRef.current?.abort()}>
            Cancel
          </button>
        </div>
      )}
      {err && !loading && (
        <div className="card p-4 border border-rose-600/40 text-sm">
          <span className="text-rose-400 font-medium">Error:</span> {err}
        </div>
      )}

      {/* Results */}
      {data && !loading && (
        <>
          <div className="card p-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <div><span className="text-zen-sub">Wallet:</span> <span className="font-mono">{data.address}</span></div>
              <div className="text-zen-sub">•</div>
              <div>Range: {formatDateTime(data.from)} → {formatDateTime(data.to)}</div>
              <div className="text-zen-sub">•</div>
              <div>Defaults: Direction Out</div>
            </div>
          </div>

          {/* Compact stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            <StatCard title="Stake" emoji="🪙" value={data.counts["stake"] || 0} />
            <StatCard title={`Native (${CHAIN.symbol})`} emoji="📤" value={data.counts["native_send"] || 0} />
            <StatCard title="NFT Mints" emoji="🖼️" value={data.counts["nft_mint"] || 0} />
            <StatCard title="Domain" emoji="🌐" value={data.counts["domain_mint"] || 0} />
            <StatCard title="Deploys (CC+CCO)" emoji="🛠️" value={deploysSum} />
            <StatCard title="GM" emoji="🌞" value={data.counts["gm"] || 0} />
            <StatCard title="Swaps" emoji="🔁" value={data.counts["swap"] || 0} />
            <StatCard title="Approvals" emoji="✅" value={data.counts["approve"] || 0} />
          </div>

          {/* Table */}
          <div className="card p-3">
            <div className="text-sm text-zen-sub mb-2">All Transactions</div>
            <TxTable rows={data.enriched as any} chainSymbol={CHAIN.symbol} defaultDirection="out" />
          </div>
        </>
      )}
    </div>
  );
}