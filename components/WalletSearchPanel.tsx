"use client";

import { useEffect, useState } from "react";
import { fromInputDateTime, msRangePreset, toInputDateTime } from "@/lib/utils";

export type SearchParams = {
  address: string;
  from: number;
  to: number;
};

function extractAddress(input: string) {
  const m = (input || "").match(/0x[0-9a-fA-F]{40}/);
  return m ? m[0] : "";
}

export default function WalletSearchPanel({
  initialAddress = "",
  onSearch
}: {
  initialAddress?: string;
  onSearch: (p: SearchParams) => void;
}) {
  const [address, setAddress] = useState(initialAddress);
  const [preset, setPreset] = useState<"24h" | "7d" | "30d" | "custom">("24h");

  const { from: defFrom, to: defTo } = msRangePreset("24h");
  const [start, setStart] = useState(toInputDateTime(defFrom));
  const [end, setEnd] = useState(toInputDateTime(defTo));

  useEffect(() => {
    if (preset !== "custom") {
      const r = msRangePreset(preset);
      setStart(toInputDateTime(r.from));
      setEnd(toInputDateTime(r.to));
    }
  }, [preset]);

  function handleSearch() {
    const addr = extractAddress(address.trim());
    const from = preset === "custom" ? fromInputDateTime(start) : msRangePreset(preset).from;
    const to = preset === "custom" ? fromInputDateTime(end) : msRangePreset(preset).to;
    onSearch({ address: addr, from, to });
  }

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[280px]">
          <label className="block text-sm text-zen-sub mb-1">Wallet address</label>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="0x... or paste a line like 'user,0xabc...'"
            className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 outline-none focus:border-zen-accent"
          />
        </div>
        <div>
          <label className="block text-sm text-zen-sub mb-1">Range</label>
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value as any)}
            className="bg-black/30 border border-white/10 rounded-xl px-3 py-2 outline-none focus:border-zen-accent"
          >
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="custom">Custom…</option>
          </select>
        </div>
        {preset === "custom" && (
          <>
            <div>
              <label className="block text-sm text-zen-sub mb-1">Start</label>
              <input
                type="datetime-local"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="bg-black/30 border border-white/10 rounded-xl px-3 py-2 outline-none focus:border-zen-accent"
              />
            </div>
            <div>
              <label className="block text-sm text-zen-sub mb-1">End</label>
              <input
                type="datetime-local"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="bg-black/30 border border-white/10 rounded-xl px-3 py-2 outline-none focus:border-zen-accent"
              />
            </div>
          </>
        )}
        <button onClick={handleSearch} className="btn h-[42px]">Check Stats</button>
      </div>
      <div className="text-xs text-zen-sub mt-2">
        You can paste a full line like "discord,0xabc..." or an Explorer URL — we’ll extract the address automatically.
      </div>
    </div>
  );
}