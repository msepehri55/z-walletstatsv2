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
  const [preset, setPreset] = useState<"24h" | "7d" | "30d" | "custom">("7d");
  const { from: defFrom, to: defTo } = msRangePreset("7d");
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
    const addr = extractAddress(address.trim()).toLowerCase();
    const from = preset === "custom" ? fromInputDateTime(start) : msRangePreset(preset).from;
    const to = preset === "custom" ? fromInputDateTime(end) : msRangePreset(preset).to;
    onSearch({ address: addr, from, to });
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto] gap-2">
      <input
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        placeholder="0x... (or paste 'user,0x...' / explorer URL)"
        className="w-full bg-black/30 border border-white/10 rounded-md px-3 py-2 text-sm outline-none focus:border-zen-accent"
      />
      <select
        value={preset}
        onChange={(e) => setPreset(e.target.value as any)}
        className="bg-black/30 border border-white/10 rounded-md px-2 py-2 text-sm outline-none focus:border-zen-accent"
      >
        <option value="24h">Last 24h</option>
        <option value="7d">Last 7 days</option>
        <option value="30d">Last 30 days</option>
        <option value="custom">Custom…</option>
      </select>
      {preset === "custom" ? (
        <>
          <input type="datetime-local" value={start} onChange={(e)=>setStart(e.target.value)} className="bg-black/30 border border-white/10 rounded-md px-2 py-2 text-sm outline-none focus:border-zen-accent"/>
          <input type="datetime-local" value={end} onChange={(e)=>setEnd(e.target.value)} className="bg-black/30 border border-white/10 rounded-md px-2 py-2 text-sm outline-none focus:border-zen-accent"/>
        </>
      ) : (
        <button onClick={handleSearch} className="btn text-sm h-[38px]">Check</button>
      )}
      {preset === "custom" && <button onClick={handleSearch} className="btn text-sm h-[38px] md:col-start-4">Check</button>}
    </div>
  );
}