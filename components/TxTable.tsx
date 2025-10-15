"use client";

import { useMemo, useState } from "react";
import { CATEGORY_META, CATEGORY_OPTIONS, shortHash } from "@/lib/categoryMeta";
import { Category } from "@/lib/constants";
import CategoryBadge from "./CategoryBadge";
import { explorerAddressUrl, explorerTxUrl, cls, formatDateTime, formatNumber, formatZTC } from "@/lib/utils";
import { TxEnriched } from "@/lib/types";

type SortKey = "timeDesc" | "timeAsc" | "amountDesc" | "amountAsc";

export default function TxTable({
  rows,
  defaultDirection = "out",
  chainSymbol = "ZTC"
}: {
  rows: TxEnriched[];
  defaultDirection?: "out" | "in" | "all";
  chainSymbol?: string;
}) {
  const [category, setCategory] = useState<"all" | Category>("all");
  const [direction, setDirection] = useState<"out" | "in" | "all">(defaultDirection);
  const [sortKey, setSortKey] = useState<SortKey>("timeDesc");
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let r = rows;
    if (category !== "all") r = r.filter(x => x.category === category);
    if (direction !== "all") r = r.filter(x => x.direction === direction);
    switch (sortKey) {
      case "timeAsc": r = [...r].sort((a,b)=>a.timeStamp-b.timeStamp); break;
      case "timeDesc": r = [...r].sort((a,b)=>b.timeStamp-a.timeStamp); break;
      case "amountAsc": r = [...r].sort((a,b)=>Number(a.amountNative)-Number(b.amountNative)); break;
      case "amountDesc": r = [...r].sort((a,b)=>Number(b.amountNative)-Number(a.amountNative)); break;
    }
    return r;
  }, [rows, category, direction, sortKey]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  function resetPage() {
    setPage(1);
  }

  return (
    <div className="card p-4 mt-4">
      <div className="flex flex-wrap gap-3 items-end">
        <select
          value={category}
          onChange={e => { setCategory(e.target.value as any); resetPage(); }}
          className="bg-black/30 border border-white/10 rounded-xl px-3 py-2 outline-none focus:border-zen-accent"
        >
          {CATEGORY_OPTIONS.map(o => <option key={o.key} value={o.key as any}>{o.label}</option>)}
        </select>
        <select
          value={direction}
          onChange={e => { setDirection(e.target.value as any); resetPage(); }}
          className="bg-black/30 border border-white/10 rounded-xl px-3 py-2 outline-none focus:border-zen-accent"
        >
          <option value="out">Direction: Out</option>
          <option value="in">Direction: In</option>
          <option value="all">Direction: All</option>
        </select>
        <select
          value={sortKey}
          onChange={e => setSortKey(e.target.value as SortKey)}
          className="bg-black/30 border border-white/10 rounded-xl px-3 py-2 outline-none focus:border-zen-accent"
        >
          <option value="timeDesc">Sort: Time (newest)</option>
          <option value="timeAsc">Sort: Time (oldest)</option>
          <option value="amountDesc">Sort: Amount (high→low)</option>
          <option value="amountAsc">Sort: Amount (low→high)</option>
        </select>
        <select
          value={pageSize}
          onChange={e => { setPageSize(Number(e.target.value)); resetPage(); }}
          className="bg-black/30 border border-white/10 rounded-xl px-3 py-2 outline-none focus:border-zen-accent"
        >
          <option value={25}>Rows: 25</option>
          <option value={50}>Rows: 50</option>
          <option value={100}>Rows: 100</option>
        </select>
        <div className="ml-auto text-sm text-zen-sub">
          Visible rows with current filters: <span className="text-white">{formatNumber(filtered.length)}</span>
        </div>
      </div>

      <div className="overflow-auto mt-4">
        <table className="min-w-full text-sm">
          <thead className="text-zen-sub">
            <tr className="border-b border-white/5">
              <th className="text-left py-2 pr-4">Time</th>
              <th className="text-left py-2 pr-4">Category / Direction</th>
              <th className="text-left py-2 pr-4">Tx Hash</th>
              <th className="text-left py-2 pr-4">From</th>
              <th className="text-left py-2 pr-4">To</th>
              <th className="text-right py-2 pr-2">Amount</th>
              <th className="text-left py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((t) => {
              const meta = CATEGORY_META[t.category];
              return (
                <tr key={t.hash} className="border-b border-white/5 hover:bg-white/5">
                  <td className="py-2 pr-4 whitespace-nowrap">{formatDateTime(t.timeStamp)}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">
                    <CategoryBadge category={t.category} />
                    <span className={cls("ml-2 text-xs px-2 py-0.5 rounded-full", t.direction === "out" ? "bg-emerald-500/15 text-emerald-300" : "bg-sky-500/15 text-sky-300")}>
                      {t.direction}
                    </span>
                  </td>
                  <td className="py-2 pr-4">
                    <a href={explorerTxUrl(t.hash)} target="_blank" className="text-zen-accent hover:underline">{shortHash(t.hash)}</a>
                  </td>
                  <td className="py-2 pr-4">
                    {t.from ? <a href={explorerAddressUrl(t.from)} target="_blank" className="text-white/90 hover:underline">{shortHash(t.from)}</a> : "—"}
                  </td>
                  <td className="py-2 pr-4">
                    {t.to ? <a href={explorerAddressUrl(t.to)} target="_blank" className="text-white/90 hover:underline">{shortHash(t.to)}</a> : <span className="text-zen-sub">contract creation</span>}
                  </td>
                  <td className="py-2 pr-2 text-right">
                    {formatZTC(t.amountNative)} <span className="text-zen-sub">{chainSymbol}</span>
                  </td>
                  <td className="py-2">{t.status === 1 ? <span className="text-emerald-400">Success</span> : <span className="text-rose-400">Fail</span>}</td>
                </tr>
              );
            })}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-zen-sub">No transactions match current filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2 mt-4">
        <button
          className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20"
          onClick={() => setPage(p => Math.max(1, p-1))}
          disabled={page <= 1}
        >
          Prev
        </button>
        <div className="text-sm text-zen-sub">Page {page} / {totalPages}</div>
        <button
          className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20"
          onClick={() => setPage(p => Math.min(totalPages, p+1))}
          disabled={page >= totalPages}
        >
          Next
        </button>
      </div>
    </div>
  );
}