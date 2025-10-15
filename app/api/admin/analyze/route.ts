import { NextRequest, NextResponse } from "next/server";
import { Auth } from "@/lib/auth";
import { computeAddressStats } from "@/lib/stats";
import { Thresholds } from "@/lib/types";

export const runtime = "edge";

type Participant = { discord?: string; wallet: string };

function normalizeWallet(a: string) {
  return a.trim().toLowerCase();
}

function parseThresholds(obj: any): Required<Thresholds> & { minTotalExternalOut: number } {
  const get = (k: string) => Math.max(0, Number(obj?.[k] ?? 0)) || 0;
  return {
    minTotalExternalOut: get("minTotalExternalOut"),
    minStake: get("minStake"),
    minNative: get("minNative"),
    minNftMint: get("minNftMint"),
    minDomainMint: get("minDomainMint"),
    minGM: get("minGM"),
    minCC: get("minCC"),
    minSwap: get("minSwap"),
    minAddLiq: get("minAddLiq"),
    minRemoveLiq: get("minRemoveLiq")
  };
}

function allocLeniency(deficits: Record<string, number>, leniency: number) {
  // Greedy: reduce largest deficits first to minimize missed categories count
  const keys = Object.keys(deficits);
  const arr = keys.map(k => ({ k, d: deficits[k] })).filter(x => x.d > 0);
  arr.sort((a, b) => b.d - a.d);
  let left = leniency;
  for (const it of arr) {
    if (left <= 0) break;
    const use = Math.min(it.d, left);
    it.d -= use;
    left -= use;
  }
  const after: Record<string, number> = {};
  for (const it of arr) after[it.k] = it.d;
  return { after, leftOver: left };
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get(Auth.cookieName)?.value;
  const payload = await Auth.verify(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const items: Participant[] = Array.isArray(body?.participants) ? body.participants : [];
  const from = Number(body?.from) || 0;
  const to = Number(body?.to) || Date.now();
  const leniency = Math.max(0, Number(body?.leniency) || 0);
  const concurrency = Math.min(12, Math.max(1, Number(body?.concurrency) || 4));
  const thresholds = parseThresholds(body?.thresholds || {});
  const groupByDiscord = !!body?.groupByDiscord;

  const participants = items
    .map(p => ({ discord: p.discord?.trim() || undefined, wallet: normalizeWallet(p.wallet) }))
    .filter(p => /^0x[a-f0-9]{40}$/.test(p.wallet));

  // Concurrency helper
  async function pMapLimit<T, R>(list: T[], limit: number, fn: (x: T, i: number) => Promise<R>): Promise<R[]> {
    const ret: R[] = new Array(list.length);
    let i = 0;
    let active = 0;
    return await new Promise((resolve, reject) => {
      const next = () => {
        if (i >= list.length && active === 0) return resolve(ret);
        while (active < limit && i < list.length) {
          const idx = i++;
          active++;
          fn(list[idx], idx)
            .then(res => { ret[idx] = res; active--; next(); })
            .catch(err => reject(err));
        }
      };
      next();
    });
  }

  type CountBucket = {
    stake: number;
    native: number;
    nft: number;
    domain: number;
    gm: number;
    cc: number; // cc + cco
    swap: number;
    add: number;
    remove: number;
  };

  type ScoreRow = {
    discord?: string;
    wallet?: string;
    wallets?: string[];
    totals: { txOut: number };
    counts: CountBucket;
    deficits: Record<string, number>;
    deficitSum: number;
    metAll: boolean;
    metWithLeniency: boolean;
    missedAfterLeniency: number;
  };

  // Fetch stats for each wallet using same pipeline as main page
  const walletRows = await pMapLimit(participants, concurrency, async (p) => {
    const s = await computeAddressStats(p.wallet, from, to);
    const c = s.countsByCategoryOut;
    const counts: CountBucket = {
      stake: c["stake"] || 0,
      native: c["native_send"] || 0,
      nft: c["nft_mint"] || 0,
      domain: c["domain_mint"] || 0,
      gm: c["gm"] || 0,
      cc: (c["cc_deploy"] || 0) + (c["cco_deploy"] || 0),
      swap: c["swap"] || 0,
      add: c["add_liquidity"] || 0,
      remove: c["remove_liquidity"] || 0
    };

    // Compute deficits against per-category thresholds
    const deficits: Record<string, number> = {};
    const addDef = (key: string, need: number, have: number) => {
      if (need > 0) deficits[key] = Math.max(0, need - have);
    };
    addDef("stake", thresholds.minStake, counts.stake);
    addDef("native", thresholds.minNative, counts.native);
    addDef("nft", thresholds.minNftMint, counts.nft);
    addDef("domain", thresholds.minDomainMint, counts.domain);
    addDef("gm", thresholds.minGM, counts.gm);
    addDef("cc", thresholds.minCC, counts.cc);
    addDef("swap", thresholds.minSwap, counts.swap);
    addDef("add", thresholds.minAddLiq, counts.add);
    addDef("remove", thresholds.minRemoveLiq, counts.remove);

    const deficitSum = Object.values(deficits).reduce((a, b) => a + b, 0);

    // Check total external out requirement (not part of leniency)
    const meetsTotal = (s.totals.txOut || 0) >= thresholds.minTotalExternalOut;

    // Apply leniency across category deficits only
    const { after } = allocLeniency(deficits, leniency);
    const missedAfterLeniency = Object.values(after).filter(v => v > 0).length;

    const metAll = meetsTotal && deficitSum === 0;
    const metWithLeniency = meetsTotal && deficitSum > 0 && Object.values(after).every(v => v === 0);

    const row: ScoreRow = {
      discord: p.discord,
      wallet: p.wallet,
      totals: { txOut: s.totals.txOut },
      counts,
      deficits,
      deficitSum,
      metAll,
      metWithLeniency,
      missedAfterLeniency
    };
    return row;
  });

  // Group by Discord (sum across wallets) if requested
  let finalRows: ScoreRow[];
  if (groupByDiscord) {
    const map = new Map<string, ScoreRow>();
    for (const r of walletRows) {
      const key = (r.discord || "(no discord)").toLowerCase();
      const prev = map.get(key);
      if (!prev) {
        map.set(key, {
          discord: r.discord,
          wallets: r.wallet ? [r.wallet] : [],
          totals: { txOut: r.totals.txOut },
          counts: { ...r.counts },
          deficits: {}, // recompute after sum
          deficitSum: 0,
          metAll: false,
          metWithLeniency: false,
          missedAfterLeniency: 0
        });
      } else {
        prev.wallets = [...(prev.wallets || []), ...(r.wallet ? [r.wallet] : [])];
        prev.totals.txOut += r.totals.txOut;
        prev.counts.stake += r.counts.stake;
        prev.counts.native += r.counts.native;
        prev.counts.nft += r.counts.nft;
        prev.counts.domain += r.counts.domain;
        prev.counts.gm += r.counts.gm;
        prev.counts.cc += r.counts.cc;
        prev.counts.swap += r.counts.swap;
        prev.counts.add += r.counts.add;
        prev.counts.remove += r.counts.remove;
      }
    }
    // Recompute deficits and statuses for grouped rows
    finalRows = Array.from(map.values()).map((r) => {
      const deficits: Record<string, number> = {};
      const addDef = (k: string, need: number, have: number) => { if (need > 0) deficits[k] = Math.max(0, need - have); };
      addDef("stake", thresholds.minStake, r.counts.stake);
      addDef("native", thresholds.minNative, r.counts.native);
      addDef("nft", thresholds.minNftMint, r.counts.nft);
      addDef("domain", thresholds.minDomainMint, r.counts.domain);
      addDef("gm", thresholds.minGM, r.counts.gm);
      addDef("cc", thresholds.minCC, r.counts.cc);
      addDef("swap", thresholds.minSwap, r.counts.swap);
      addDef("add", thresholds.minAddLiq, r.counts.add);
      addDef("remove", thresholds.minRemoveLiq, r.counts.remove);
      const deficitSum = Object.values(deficits).reduce((a, b) => a + b, 0);
      const meetsTotal = r.totals.txOut >= thresholds.minTotalExternalOut;
      const { after } = allocLeniency(deficits, leniency);
      const missedAfterLeniency = Object.values(after).filter(v => v > 0).length;
      const metAll = meetsTotal && deficitSum === 0;
      const metWithLeniency = meetsTotal && deficitSum > 0 && Object.values(after).every(v => v === 0);
      return { ...r, deficits, deficitSum, metAll, metWithLeniency, missedAfterLeniency };
    });
  } else {
    finalRows = walletRows;
  }

  // Split into winner buckets
  const completed = finalRows.filter(r => r.metAll);
  const withLeniency = finalRows.filter(r => !r.metAll && r.metWithLeniency);
  const missed1 = finalRows.filter(r => !r.metAll && !r.metWithLeniency && r.missedAfterLeniency === 1);
  const missed2 = finalRows.filter(r => !r.metAll && !r.metWithLeniency && r.missedAfterLeniency === 2);
  const missed3 = finalRows.filter(r => !r.metAll && !r.metWithLeniency && r.missedAfterLeniency >= 3);

  const result = {
    params: { from, to, leniency, concurrency, thresholds, groupByDiscord },
    totals: { participants: participants.length, rows: finalRows.length },
    winners: {
      completed,
      withLeniency,
      missed1,
      missed2,
      missed3
    }
  };

  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}