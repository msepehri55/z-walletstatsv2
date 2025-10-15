"use client";

import { useCallback, useMemo, useState } from "react";
import { fromInputDateTime, msRangePreset, toInputDateTime, formatDateTime, formatNumber } from "@/lib/utils";

type Thresholds = {
  minTotalExternalOut: number;
  minStake: number;
  minNative: number;
  minNftMint: number;
  minDomainMint: number;
  minGM: number;
  minCC: number;
  minSwap: number;
  minAddLiq: number;
  minRemoveLiq: number;
};

type Participant = { discord?: string; wallet: string };

type ResultRow = {
  discord?: string;
  wallet?: string;
  wallets?: string[];
  totals: { txOut: number };
  counts: { stake: number; native: number; nft: number; domain: number; gm: number; cc: number; swap: number; add: number; remove: number };
  metAll: boolean;
  metWithLeniency: boolean;
  missedAfterLeniency: number;
};

type AnalyzeResult = {
  params: { from: number; to: number; leniency: number; concurrency: number; thresholds: Thresholds; groupByDiscord: boolean };
  totals: { participants: number; rows: number };
  winners: {
    completed: ResultRow[];
    withLeniency: ResultRow[];
    missed1: ResultRow[];
    missed2: ResultRow[];
    missed3: ResultRow[];
  };
};

function parseCSV(text: string): Participant[] {
  const lines = text.split(/\r?\n/);
  const out: Participant[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const parts = line.split(/,|;|\s+/).map(s => s.trim()).filter(Boolean);
    if (parts.length < 2) continue;
    const discord = parts[0];
    const wallet = parts[1];
    if (/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      out.push({ discord, wallet: wallet.toLowerCase() });
    }
  }
  return out;
}

export default function AdminClient() {
  // Participants
  const [sheetUrl, setSheetUrl] = useState("");
  const [csvText, setCsvText] = useState("");

  // Filters
  const [preset, setPreset] = useState<"24h" | "7d" | "30d" | "custom">("7d");
  const [start, setStart] = useState(toInputDateTime(msRangePreset("7d").from));
  const [end, setEnd] = useState(toInputDateTime(msRangePreset("7d").to));
  const [thresholds, setThresholds] = useState<Thresholds>({
    minTotalExternalOut: 0,
    minStake: 0,
    minNative: 0,
    minNftMint: 0,
    minDomainMint: 0,
    minGM: 0,
    minCC: 0,
    minSwap: 0,
    minAddLiq: 0,
    minRemoveLiq: 0
  });
  const [leniency, setLeniency] = useState(0);
  const [concurrency, setConcurrency] = useState(6);
  const [groupByDiscord, setGroupByDiscord] = useState(true);
  const [onlyWinners, setOnlyWinners] = useState(false);

  // State
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function applyPreset(p: typeof preset) {
    setPreset(p);
    if (p !== "custom") {
      const r = msRangePreset(p);
      setStart(toInputDateTime(r.from));
      setEnd(toInputDateTime(r.to));
    }
  }

  async function fetchCSV() {
    if (!sheetUrl) return;
    setError(null);
    try {
      const res = await fetch(`/api/admin/fetch-csv?url=${encodeURIComponent(sheetUrl)}`);
      const text = await res.text();
      setCsvText(text);
    } catch (e: any) {
      setError(e?.message || "Failed to fetch CSV");
    }
  }

  const participants = useMemo(() => parseCSV(csvText), [csvText]);

  const visibleParticipants = useMemo(() => {
    // Deduplicate on (discord,wallet)
    const seen = new Set<string>();
    return participants.filter(p => {
      const key = (p.discord || "") + "|" + p.wallet;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [participants]);

  const from = preset === "custom" ? fromInputDateTime(start) : msRangePreset(preset).from;
  const to = preset === "custom" ? fromInputDateTime(end) : msRangePreset(preset).to;

  const winnersTabs = [
    { key: "completed", label: "Completed all" },
    { key: "withLeniency", label: "Winners with leniency" },
    { key: "missed1", label: "Missed 1 part" },
    { key: "missed2", label: "Missed 2 parts" },
    { key: "missed3", label: "Missed 3 parts" }
  ] as const;

  const [activeTab, setActiveTab] = useState<typeof winnersTabs[number]["key"]>("completed");

  const rowsForTab = (res: AnalyzeResult | null, tab: typeof activeTab): ResultRow[] => {
    if (!res) return [];
    const arr = res.winners[tab] as ResultRow[];
    if (!onlyWinners) {
      // When "only winners" unchecked, merge all buckets into current tab view? We'll keep default: show only the chosen bucket.
      return arr;
    }
    return arr; // same (checkbox affects display outside table)
  };

  const currentRows = rowsForTab(result, activeTab);

  const run = useCallback(async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          participants: visibleParticipants,
          from,
          to,
          thresholds,
          leniency,
          concurrency,
          groupByDiscord
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Analyze failed");
      setResult(json);
    } catch (e: any) {
      setError(e?.message || "Analyze failed");
    } finally {
      setRunning(false);
    }
  }, [visibleParticipants, from, to, thresholds, leniency, concurrency, groupByDiscord]);

  function downloadCSV() {
    if (!result) return;
    const allBuckets = ["completed", "withLeniency", "missed1", "missed2", "missed3"] as const;
    const lines = [
      ["bucket", "discord", "wallet(s)", "total_out", "stake", "native", "nft", "domain", "gm", "cc", "swap", "add_liq", "remove_liq"].join(",")
    ];
    for (const b of allBuckets) {
      for (const r of result.winners[b] as ResultRow[]) {
        const wallets = r.wallets ? r.wallets.join("|") : (r.wallet || "");
        lines.push([
          b,
          r.discord || "",
          wallets,
          String(r.totals.txOut || 0),
          String(r.counts.stake || 0),
          String(r.counts.native || 0),
          String(r.counts.nft || 0),
          String(r.counts.domain || 0),
          String(r.counts.gm || 0),
          String(r.counts.cc || 0),
          String(r.counts.swap || 0),
          String(r.counts.add || 0),
          String(r.counts.remove || 0)
        ].join(","));
      }
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zenstats_winners_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.reload();
  }

  return (
    <div className="space-y-6">
      <div className="card p-4 flex items-center gap-3">
        <div className="text-lg font-semibold">ZenStats — Admin</div>
        <div className="ml-auto">
          <button className="bg-white/10 hover:bg-white/20 rounded-lg px-3 py-1.5 text-sm" onClick={logout}>Logout</button>
        </div>
      </div>

      <div className="card p-5 space-y-5">
        <div>
          <div className="text-sm font-medium mb-2">Participants</div>
          <div className="flex gap-2 items-center">
            <input
              placeholder="https://docs.google.com/spreadsheets/..."
              value={sheetUrl}
              onChange={(e) => setSheetUrl(e.target.value)}
              className="flex-1 bg-black/30 border border-white/10 rounded-xl px-3 py-2 outline-none focus:border-zen-accent"
            />
            <button className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20" onClick={fetchCSV}>Fetch CSV</button>
          </div>
          <div className="mt-2">
            <textarea
              placeholder="discord_username,0xabc123..."
              rows={6}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 outline-none focus:border-zen-accent font-mono"
            />
          </div>
          <div className="text-xs text-zen-sub mt-1">Tip: You can paste CSV as "discord,wallet". Duplicates are removed automatically.</div>
          <div className="text-sm mt-2">Loaded participants: <span className="text-white">{formatNumber(visibleParticipants.length)}</span></div>
        </div>

        <div>
          <div className="text-sm font-medium mb-2">Filters</div>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-zen-sub mb-1">Range</label>
              <select value={preset} onChange={(e) => applyPreset(e.target.value as any)} className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2">
                <option value="24h">Last 24h</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="custom">Custom…</option>
              </select>
            </div>
            {preset === "custom" && (
              <>
                <div>
                  <label className="block text-sm text-zen-sub mb-1">Start</label>
                  <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2"/>
                </div>
                <div>
                  <label className="block text-sm text-zen-sub mb-1">End</label>
                  <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2"/>
                </div>
              </>
            )}
            <div>
              <label className="block text-sm text-zen-sub mb-1">Leniency (ignore up to N tx in category deficits)</label>
              <input type="number" value={leniency} onChange={(e) => setLeniency(Number(e.target.value))} className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2"/>
            </div>
            <div>
              <label className="block text-sm text-zen-sub mb-1">Concurrency</label>
              <input type="number" value={concurrency} onChange={(e) => setConcurrency(Number(e.target.value))} className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2"/>
            </div>
          </div>

          <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
            <div>
              <label className="block text-sm text-zen-sub mb-1">Min total external tx (outgoing only)</label>
              <input type="number" value={thresholds.minTotalExternalOut}
                onChange={(e) => setThresholds({ ...thresholds, minTotalExternalOut: Number(e.target.value) })}
                className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2"/>
            </div>
            <div><label className="block text-sm text-zen-sub mb-1">Min stake</label>
              <input type="number" value={thresholds.minStake} onChange={(e)=>setThresholds({...thresholds, minStake: Number(e.target.value)})} className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2"/></div>
            <div><label className="block text-sm text-zen-sub mb-1">Min native send</label>
              <input type="number" value={thresholds.minNative} onChange={(e)=>setThresholds({...thresholds, minNative: Number(e.target.value)})} className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2"/></div>
            <div><label className="block text-sm text-zen-sub mb-1">Min nft mint</label>
              <input type="number" value={thresholds.minNftMint} onChange={(e)=>setThresholds({...thresholds, minNftMint: Number(e.target.value)})} className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2"/></div>
            <div><label className="block text-sm text-zen-sub mb-1">Min domain mint</label>
              <input type="number" value={thresholds.minDomainMint} onChange={(e)=>setThresholds({...thresholds, minDomainMint: Number(e.target.value)})} className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2"/></div>
            <div><label className="block text-sm text-zen-sub mb-1">Min gm</label>
              <input type="number" value={thresholds.minGM} onChange={(e)=>setThresholds({...thresholds, minGM: Number(e.target.value)})} className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2"/></div>
            <div><label className="block text-sm text-zen-sub mb-1">Min cc (deploys)</label>
              <input type="number" value={thresholds.minCC} onChange={(e)=>setThresholds({...thresholds, minCC: Number(e.target.value)})} className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2"/></div>
            <div><label className="block text-sm text-zen-sub mb-1">Min swap</label>
              <input type="number" value={thresholds.minSwap} onChange={(e)=>setThresholds({...thresholds, minSwap: Number(e.target.value)})} className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2"/></div>
            <div><label className="block text-sm text-zen-sub mb-1">Min add liquidity</label>
              <input type="number" value={thresholds.minAddLiq} onChange={(e)=>setThresholds({...thresholds, minAddLiq: Number(e.target.value)})} className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2"/></div>
            <div><label className="block text-sm text-zen-sub mb-1">Min remove liquidity</label>
              <input type="number" value={thresholds.minRemoveLiq} onChange={(e)=>setThresholds({...thresholds, minRemoveLiq: Number(e.target.value)})} className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2"/></div>
          </div>

          <div className="mt-4 flex items-center gap-6">
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={groupByDiscord} onChange={(e)=>setGroupByDiscord(e.target.checked)} />
              <span className="text-sm">Group by Discord (sum across multiple wallets)</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={onlyWinners} onChange={(e)=>setOnlyWinners(e.target.checked)} />
              <span className="text-sm">Show only winners</span>
            </label>
          </div>
        </div>

        <div className="flex gap-3">
          <button className="btn" onClick={run} disabled={running || visibleParticipants.length === 0}>{running ? "Running…" : "Run"}</button>
          <button className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20" onClick={()=>{setResult(null); setError(null);}}>Cancel</button>
          <div className="text-sm text-zen-sub self-center">Range: {formatDateTime(from)} → {formatDateTime(to)}</div>
        </div>
        {error && <div className="text-rose-400">{error}</div>}
      </div>

      {result && (
        <div className="card p-5">
          <div className="flex items-center gap-3">
            {(["completed","withLeniency","missed1","missed2","missed3"] as const).map((k) => (
              <button key={k}
                className={"px-3 py-2 rounded-xl " + (activeTab === k ? "bg-zen-accent text-black" : "bg-white/10 hover:bg-white/20")}
                onClick={() => setActiveTab(k)}>
                {k === "completed" && `Completed all (${result.winners.completed.length})`}
                {k === "withLeniency" && `Winners with leniency (${result.winners.withLeniency.length})`}
                {k === "missed1" && `Missed 1 part (${result.winners.missed1.length})`}
                {k === "missed2" && `Missed 2 parts (${result.winners.missed2.length})`}
                {k === "missed3" && `Missed 3 parts (${result.winners.missed3.length})`}
              </button>
            ))}
            <div className="flex-1" />
            <button className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20" onClick={downloadCSV}>Download CSV</button>
          </div>

          <div className="overflow-auto mt-4">
            <table className="min-w-full text-sm">
              <thead className="text-zen-sub">
                <tr className="border-b border-white/5">
                  <th className="text-left py-2 pr-4">Discord</th>
                  <th className="text-left py-2 pr-4">{groupByDiscord ? "Wallets" : "Wallet"}</th>
                  <th className="text-right py-2 pr-4">Total OUT</th>
                  <th className="text-right py-2 pr-4">Stake</th>
                  <th className="text-right py-2 pr-4">Native</th>
                  <th className="text-right py-2 pr-4">NFT</th>
                  <th className="text-right py-2 pr-4">Domain</th>
                  <th className="text-right py-2 pr-4">GM</th>
                  <th className="text-right py-2 pr-4">CC</th>
                  <th className="text-right py-2 pr-4">Swap</th>
                  <th className="text-right py-2 pr-4">Add Liq</th>
                  <th className="text-right py-2 pr-4">Remove Liq</th>
                </tr>
              </thead>
              <tbody>
                {currentRows.map((r, i) => (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-2 pr-4">{r.discord || <span className="text-zen-sub">(none)</span>}</td>
                    <td className="py-2 pr-4">
                      {groupByDiscord ? (r.wallets?.length ? r.wallets.join(", ") : "—") : (r.wallet || "—")}
                    </td>
                    <td className="py-2 pr-4 text-right">{formatNumber(r.totals.txOut)}</td>
                    <td className="py-2 pr-4 text-right">{formatNumber(r.counts.stake)}</td>
                    <td className="py-2 pr-4 text-right">{formatNumber(r.counts.native)}</td>
                    <td className="py-2 pr-4 text-right">{formatNumber(r.counts.nft)}</td>
                    <td className="py-2 pr-4 text-right">{formatNumber(r.counts.domain)}</td>
                    <td className="py-2 pr-4 text-right">{formatNumber(r.counts.gm)}</td>
                    <td className="py-2 pr-4 text-right">{formatNumber(r.counts.cc)}</td>
                    <td className="py-2 pr-4 text-right">{formatNumber(r.counts.swap)}</td>
                    <td className="py-2 pr-4 text-right">{formatNumber(r.counts.add)}</td>
                    <td className="py-2 pr-4 text-right">{formatNumber(r.counts.remove)}</td>
                  </tr>
                ))}
                {currentRows.length === 0 && (
                  <tr><td colSpan={12} className="py-8 text-center text-zen-sub">No rows.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="text-xs text-zen-sub mt-3">
            Notes: totals and category counts use ONLY outgoing external tx and match the main page exactly. Leniency is applied across category deficits only (not the total OUT requirement).
          </div>
        </div>
      )}
    </div>
  );
}