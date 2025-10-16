"use client";

import { useCallback, useMemo, useState } from "react";
import WalletSearchPanel, { SearchParams } from "./WalletSearchPanel";
import StatCard from "./StatCard";
import TxTable from "./TxTable";
import { CATEGORY_ORDER, CHAIN } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import { buildActivityFast, buildStatsFromActivity } from "@/lib/zenShared";

function mapCategory(c: string): any {
  switch (c) {
    case "cc": return "cc_deploy";
    case "cco": return "cco_deploy";
    case "stake": return "stake";
    case "gm": return "gm";
    case "swap": return "swap";
    case "add_liquidity": return "add_liquidity";
    case "remove_liquidity": return "remove_liquidity";
    case "approve": return "approve";
    case "native_send": return "native_send";
    case "nft_mint": return "nft_mint";
    case "domain_mint": return "domain_mint";
    case "fail": return "fail";
    default: return "other";
  }
}

export default function MainClientDirect() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>("");

  const [address, setAddress] = useState<string>("");
  const [range, setRange] = useState<{ from: number; to: number } | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});

  const onSearch = useCallback(async (p: SearchParams) => {
    setErr(null);
    setLoading(true);
    setRows([]);
    setCounts({});
    setAddress(p.address.toLowerCase());
    setRange({ from: p.from, to: p.to });
    setProgress("Explorer scan…");

    try {
      const activity = await buildActivityFast({
        address: p.address.toLowerCase(),
        start: Math.floor(p.from / 1000),
        end: Math.floor(p.to / 1000)
      });

      const enriched = activity.map((r: any) => ({
        hash: r.hash,
        blockNumber: r.blockNumber || 0,
        timeStamp: r.timeMs || 0,
        from: r.from,
        to: r.to,
        valueWei: "0",
        input: "0x",
        status: r.category === "fail" ? 0 : 1,
        direction: r.direction || "out",
        category: mapCategory(r.category || "other"),
        amountNative: String(r.value || "0"),
        logsChecked: false
      }));

      const s = buildStatsFromActivity(activity);
      const outCounts: Record<string, number> = {
        stake: s.stakeActions || 0,
        native_send: s.nativeSends || 0,
        nft_mint: s.nftMints || 0,
        domain_mint: s.domainMints || 0,
        gm: s.gmCount || 0,
        cc_deploy: s.ccCount || 0,
        cco_deploy: 0,
        swap: s.swapCount || 0,
        add_liquidity: s.addLiquidityCount || 0,
        remove_liquidity: s.removeLiquidityCount || 0,
        approve: s.approveCount || 0,
        fail: 0,
        other: 0,
        total_out: s.totalExternalOut || 0
      };
      for (const k of CATEGORY_ORDER) outCounts[k] = outCounts[k] || 0;

      setRows(enriched);
      setCounts(outCounts);
      setProgress("");
    } catch (e: any) {
      setErr(e?.message || "Failed to fetch");
    } finally {
      setLoading(false);
      setProgress("");
    }
  }, []);

  const deploysSum = useMemo(() => (counts["cc_deploy"] || 0) + (counts["cco_deploy"] || 0), [counts]);
  const totalOut = counts["total_out"] || 0;

  return (
    <div className="space-y-8">
      {/* Premium hero (logo + mobile friendly) */}
      <section className="relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-[#0a1226] via-[#0b1a32] to-[#0a0f1f] p-6 md:p-8 shadow-2xl">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="absolute -bottom-48 -left-24 h-[28rem] w-[28rem] rounded-full bg-[#00ebc7]/8 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-3 md:gap-4">
            <img src="/zenchain-logo.png" alt="ZenChain" className="h-10 w-10 md:h-12 md:w-12 rounded-xl shadow-lg shadow-emerald-500/20" />
            <div className="min-w-0">
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">ZenChain Wallet Insights</h1>
              <p className="text-xs md:text-sm text-zen-sub">Explorer-direct analysis • accurate categories • fast results</p>
            </div>
          </div>
          <div className="mt-5">
            <WalletSearchPanel onSearch={onSearch} />
          </div>
          {(loading || progress) && (
            <div className="mt-4 flex items-center gap-3 text-sm">
              <div className="h-3 w-3 rounded-full bg-zen-accent animate-pulse" />
              <div className="text-zen-sub">{progress || "Loading…"}</div>
            </div>
          )}
          {err && <div className="mt-4 text-rose-400 text-sm">{err}</div>}
        </div>
      </section>

      {/* KPI — Total Out added, Approve removed */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard title="Total tx (Out)" emoji="📊" value={totalOut} />
        <StatCard title="Stake" emoji="🪙" value={counts["stake"] || 0} />
        <StatCard title={`Native (${CHAIN.symbol})`} emoji="📤" value={counts["native_send"] || 0} />
        <StatCard title="NFT Mints" emoji="🖼️" value={counts["nft_mint"] || 0} />
        <StatCard title="Domain Mints" emoji="🌐" value={counts["domain_mint"] || 0} />
        <StatCard title="Deploys (CC+CCO)" emoji="🛠️" value={deploysSum} />
        <StatCard title="GM" emoji="🌞" value={counts["gm"] || 0} />
        <StatCard title="Swaps" emoji="🔁" value={counts["swap"] || 0} />
        <StatCard title="Add Liq" emoji="💧+" value={counts["add_liquidity"] || 0} />
        <StatCard title="Remove Liq" emoji="💧−" value={counts["remove_liquidity"] || 0} />
        <StatCard title="Other" emoji="📦" value={counts["other"] || 0} />
      </section>

      {/* Table */}
      <section className="rounded-3xl border border-white/5 bg-[#0b1326]/85 backdrop-blur-md shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-xs text-zen-sub border-b border-white/5">
          <div className="flex items-center gap-3">
            <div><span className="text-zen-sub">Wallet:</span> <span className="font-mono text-white/90 break-all">{address || "-"}</span></div>
            {range && (
              <>
                <div className="text-zen-sub">•</div>
                <div>Range: {formatDateTime(range.from)} → {formatDateTime(range.to)}</div>
              </>
            )}
          </div>
          <div className="text-[11px]">Rows: {rows.length.toLocaleString()}</div>
        </div>
        <div className="p-4">
          <TxTable rows={rows as any} chainSymbol={CHAIN.symbol} defaultDirection="out" defaultPageSize={25} />
        </div>
      </section>
    </div>
  );
}