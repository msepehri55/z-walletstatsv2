"use client";

import { useMemo, useState } from "react";
import { CATEGORY_META, CATEGORY_OPTIONS, shortHash } from "@/lib/categoryMeta";
import { Category } from "@/lib/constants";
import CategoryBadge from "./CategoryBadge";
import { explorerAddressUrl, explorerTxUrl, cls, formatDateTime } from "@/lib/utils";
import { TxEnriched } from "@/lib/types";

type SortKey = "timeDesc" | "timeAsc";

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
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let r = rows;
    if (category !== "all") r = r.filter(x => x.category === category);
    if (direction !== "all") r = r.filter(x => x.direction === direction);
    switch (sortKey) {
      case "timeAsc": r = [...r].sort((a,b)=>a.timeStamp-b.timeStamp); break;
      case "timeDesc": r = [...r].sort((a,b)=>b.timeStamp-a.timeStamp); break;
    }
    return r;
  }, [rows, category, direction, sortKey]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  function resetPage() { setPage(1); }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <select value={category} onChange={e => { setCategory(e.target.value as any); resetPage(); }}
          className="bg-black/30 border border-white/10 rounded-md px-2 py-1 text-xs outline-none focus:border-zen-accent">
          {CATEGORY_OPTIONS.map(o => <option key={o.key} value={o.key as any}>{o.label}</option>)}
        </select>
        <select value={direction} onChange={e => { setDirection(e.target.value as any); resetPage(); }}
          className="bg-black/30 border border-white/10 rounded-md px-2 py-1 text-xs outline-none focus:border-zen-accent">
          <option value="out">Direction: Out</option>
          <option value="in">Direction: In</option>
          <option value="all">Direction: All</option>
        </select>
        <select value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)}
          className="bg-black/30 border border-white/10 rounded-md px-2 py-1 text-xs outline-none focus:border-zen-accent">
          <option value="timeDesc">Sort: Newest</option>
          <option value="timeAsc">Sort: Oldest</option>
        </select>
        <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); resetPage(); }}
          className="bg-black/30 border border-white/10 rounded-md px-2 py-1 text-xs outline-none focus:border-zen-accent">
          <option value={50}>Rows: 50</option>
          <option value={100}>Rows: 100</option>
          <option value={200}>Rows: 200</option>
        </select>
        <div className="ml-auto text-xs text-zen-sub">Visible: {filtered.length.toLocaleString()}</div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="sticky top-0 bg-zen-panel/95 backdrop-blur">
            <tr className="border-b border-white/10">
              <th className="text-left py-2 pr-3 font-medium text-zen-sub">Time</th>
              <th className="text-left py-2 pr-3 font-medium text-zen-sub">Category / Direction</th>
              <th className="text-left py-2 pr-3 font-medium text-zen-sub">Tx Hash</th>
              <th className="text-left py-2 pr-3 font-medium text-zen-sub">From</th>
              <th className="text-left py-2 pr-3 font-medium text-zen-sub">To</th>
              <th className="text-right py-2 pr-2 font-medium text-zen-sub">Amount ({chainSymbol})</th>
              <th className="text-left py-2 pr-3 font-medium text-zen-sub">Status</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((t) => {
              return (
                <tr key={t.hash} className="border-b border-white/5 hover:bg-white/5">
                  <td className="py-2 pr-3 whitespace-nowrap">{formatDateTime(t.timeStamp)}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    <CategoryBadge category={t.category} />
                    <span className={cls("ml-2 text-[10px] px-2 py-[2px] rounded-full",
                      t.direction === "out" ? "bg-emerald-500/15 text-emerald-300" : "bg-sky-500/15 text-sky-300")}>
                      {t.direction}
                    </span>
                  </td>
                  <td className="py-2 pr-3">
                    <a href={explorerTxUrl(t.hash)} target="_blank" className="text-zen-accent hover:underline">{shortHash(t.hash)}</a>
                  </td>
                  <td className="py-2 pr-3">{t.from ? <a href={explorerAddressUrl(t.from)} target="_blank" className="hover:underline">{shortHash(t.from)}</a> : "—"}</td>
                  <td className="py-2 pr-3">
                    {t.to ? <a href={explorerAddressUrl(t.to)} target="_blank" className="hover:underline">{shortHash(t.to)}</a> : <span className="text-zen-sub">contract creation</span>}
                  </td>
                  <td className="py-2 pr-2 text-right">{t.amountNative}</td>
                  <td className="py-2 pr-3">{t.status === 1 ? <span className="text-emerald-400">Success</span> : <span className="text-rose-400">Fail</span>}</td>
                </tr>
              );
            })}
            {pageRows.length === 0 && (
              <tr><td colSpan={7} className="py-8 text-center text-zen-sub">No transactions in this view.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2">
        <button className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 text-xs" onClick={() => setPage(p => Math.max(1, p-1))} disabled={page <= 1}>Prev</button>
        <div className="text-xs text-zen-sub">Page {page} / {totalPages}</div>
        <button className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 text-xs" onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page >= totalPages}>Next</button>
      </div>
    </div>
  );
}