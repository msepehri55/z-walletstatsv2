// Explorer-only client fetcher with strict paging (compat API), 429 backoff, timeouts,
// and limited logs refinement (REST v2) for NFT/domain mint detection.

import { ENDPOINTS, STAKING_CONTRACT, GM_CONTRACTS, CCO_DEPLOY_FACTORY } from "@/lib/constants";

export type Direction = "out" | "in" | "self";
export type Category =
  | "stake" | "native_send" | "nft_mint" | "domain_mint" | "cc_deploy" | "cco_deploy" | "gm"
  | "swap" | "add_liquidity" | "remove_liquidity" | "approve" | "fail" | "other";

export type TxRow = {
  hash: string;
  blockNumber: number;
  timeStamp: number; // ms
  from: string;
  to: string | null;
  valueWei: string;
  input: string;
  status: 0 | 1;
  methodId?: string;
  contractAddress?: string | null;
};

export type Enriched = TxRow & {
  direction: Direction;
  category: Category;
  amountNative: string;
  logsChecked?: boolean;
};

type TokenInfo = { name?: string; symbol?: string; type?: string };

const METHOD = {
  approve: "0x095ea7b3",
  swap: ["0x18cbafe5","0x7ff36ab5","0x38ed1739","0xb858183f","0x414bf389","0x09b81346","0x5023b4df","0x5ae401dc"],
  addLiq: ["0xe8e33700","0xf305d719"],
  removeLiq: ["0xbaa2abde","0x02751cec"]
};

const ZERO = "0x0000000000000000000000000000000000000000";

// Tunables (balanced for reliability and speed)
const TIMEOUT = 10000;             // per-request timeout
const COMPAT_OFFSET = 10000;       // txlist page size
const COMPAT_MAX_PAGES = 200;      // up to 2M rows in window (safety cap)
const BACKOFF_BASE_MS = 700;       // base backoff for 429
const BACKOFF_TRIES = 7;           // 429 retry attempts
const GLOBAL_BUDGET_MS = 45000;    // hard cap per search (prevents infinite "Loading…")
const LOGS_CONCURRENCY = 2;        // REST logs throttle
const LOGS_LIMIT = 60;             // log refinement limit per search (for NFT/domain mint)

function sleep(ms: number) { return new Promise(res => setTimeout(res, ms)); }

function weiToEther(wei: string) {
  if (!wei) return "0";
  const neg = wei.startsWith("-");
  const s = neg ? wei.slice(1) : wei;
  const pad = s.padStart(19, "0");
  const int = pad.slice(0, -18);
  const frac = pad.slice(-18).replace(/0+$/, "");
  const out = frac ? `${int}.${frac}` : int;
  return neg ? `-${out}` : out;
}
function isHexZero(d?: string) { return !d || d === "0x" || d === "0x0"; }

function dirOf(tx: TxRow, addr: string): Direction {
  const f = (tx.from || "").toLowerCase();
  const t = (tx.to || "")?.toLowerCase() || null;
  if (f === addr && t === addr) return "self";
  if (f === addr) return "out";
  return "in";
}
function startsWithAny(x: string | undefined, arr: string[]) {
  if (!x) return false;
  const s = x.toLowerCase();
  return arr.some(p => s.startsWith(p));
}
function classifyFast(tx: TxRow, subject: string): Category {
  if (tx.status === 0) return "fail";
  const to = (tx.to || "").toLowerCase();
  const md = (tx.methodId || tx.input?.slice(0, 10) || "").toLowerCase();
  const d = dirOf(tx, subject);
  if (d === "out") {
    if (!tx.to || tx.to === "0x" || tx.to === null) return "cc_deploy";
    if (to === CCO_DEPLOY_FACTORY) return "cco_deploy";
    if (GM_CONTRACTS.includes(to)) return "gm";
    if (to === STAKING_CONTRACT) return "stake";
    if (md === METHOD.approve) return "approve";
    if (startsWithAny(md, METHOD.swap)) return "swap";
    if (startsWithAny(md, METHOD.addLiq)) return "add_liquidity";
    if (startsWithAny(md, METHOD.removeLiq)) return "remove_liquidity";
    if (isHexZero(tx.input) && tx.valueWei !== "0") return "native_send";
  }
  return "other";
}

function withTimeout<T>(p: Promise<T>, ms = TIMEOUT, signal?: AbortSignal) {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new Error("timeout")), ms);
    const onAbort = () => { clearTimeout(id); reject(new DOMException("aborted","AbortError")); };
    if (signal) signal.addEventListener("abort", onAbort, { once: true });
    p.then((v) => { clearTimeout(id); resolve(v); }, (e) => { clearTimeout(id); reject(e); });
  });
}
async function fetchJson(url: string, signal?: AbortSignal) {
  const res = await withTimeout(fetch(url, { cache: "no-store", signal }), TIMEOUT, signal);
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch {}
  return { ok: res.ok, status: res.status, data };
}
async function fetchJsonBackoff(url: string, tries = BACKOFF_TRIES, signal?: AbortSignal) {
  for (let i = 1; i <= tries; i++) {
    try {
      const r = await fetchJson(url, signal);
      if (r.status !== 429) return r;
      await sleep(BACKOFF_BASE_MS * Math.pow(1.6, i - 1));
    } catch (e: any) {
      if (e?.name === "AbortError") throw e;
      await sleep(200);
    }
  }
  return fetchJson(url, signal);
}

function compatBase() {
  return (ENDPOINTS.explorerCompatApi).replace(/\/+$/, "");
}
function restBase() {
  return (ENDPOINTS.explorerRestV2 || (ENDPOINTS.explorerBase + "/api/v2")).replace(/\/+$/, "");
}

function normCompatRow(row: any): TxRow {
  const input = row.input || "0x";
  const tsSec = Number(row.timeStamp || row.timestamp || 0);
  const ok = row.txreceipt_status === "1" || row.isError === "0" || row.success === true;
  return {
    hash: String(row.hash || ""),
    blockNumber: Number(row.blockNumber || 0),
    timeStamp: tsSec * 1000,
    from: String(row.from || "").toLowerCase(),
    to: row.to ? String(row.to).toLowerCase() : null,
    valueWei: String(row.value ?? "0"),
    input,
    status: ok ? 1 : 0,
    methodId: input.slice(0, 10),
    contractAddress: null
  };
}

// Strict, sequential paging over compat API for exact [from,to] window.
// Two-pass strategy (desc then asc) to avoid any paging quirks and guarantee completeness.
async function fetchCompatWindowPaged(address: string, fromMs: number, toMs: number, sort: "desc" | "asc", onProgress?: (s: string)=>void, signal?: AbortSignal) {
  const base = compatBase();
  const out: TxRow[] = [];
  const start = Date.now();
  let page = 1;
  let repeatGuard = 0;
  let lastFirstHash = "";

  while (page <= COMPAT_MAX_PAGES) {
    if (signal?.aborted) throw new DOMException("aborted", "AbortError");
    if (Date.now() - start > GLOBAL_BUDGET_MS) break;

    onProgress?.(`Compat ${sort} • page ${page}`);
    const qs = new URLSearchParams({
      module: "account",
      action: "txlist",
      address,
      sort,
      page: String(page),
      offset: String(COMPAT_OFFSET),
      starttimestamp: String(Math.floor(fromMs / 1000)),
      endtimestamp: String(Math.floor(toMs / 1000))
    });
    const url = `${base}?${qs.toString()}`;
    const r = await fetchJsonBackoff(url, BACKOFF_TRIES, signal);
    const arr = Array.isArray(r.data?.result) ? r.data.result : [];
    if (!arr.length) break;

    // infinite-loop guard if explorer ignores 'page'
    const firstHash = arr[0]?.hash || "";
    if (firstHash && firstHash === lastFirstHash) {
      repeatGuard++;
      if (repeatGuard >= 2) break;
    } else {
      repeatGuard = 0;
      lastFirstHash = firstHash;
    }

    out.push(...arr.map(normCompatRow));

    if (arr.length < COMPAT_OFFSET) break;

    // boundary guard: if we already covered start in desc mode, break; in asc mode, if we reached end, break.
    const oldest = normCompatRow(arr[arr.length - 1]).timeStamp;
    const newest = normCompatRow(arr[0]).timeStamp;
    if (sort === "desc" && fromMs && oldest <= fromMs) break;
    if (sort === "asc" && toMs && newest >= toMs) break;

    page++;
  }

  return out;
}

async function fetchTxLogs(hash: string, signal?: AbortSignal) {
  const base = restBase();
  const url = `${base}/transactions/${hash}/logs`;
  const r = await fetchJsonBackoff(url, BACKOFF_TRIES, signal);
  const items = Array.isArray(r.data?.items) ? r.data.items : [];
  return items.map((l: any) => ({
    address: String(l.address || "").toLowerCase(),
    topics: (l.topics || []).map((t: string) => String(t).toLowerCase()),
    data: String(l.data || "0x")
  }));
}
async function fetchTokenInfo(address: string, signal?: AbortSignal): Promise<TokenInfo> {
  const base = restBase();
  const url = `${base}/tokens/${address}`;
  const r = await fetchJsonBackoff(url, BACKOFF_TRIES, signal);
  const info: TokenInfo = {
    name: r.data?.name as string | undefined,
    symbol: r.data?.symbol as string | undefined,
    type: r.data?.type as string | undefined
  };
  return info;
}
function looksLikeDomainToken(name?: string, symbol?: string) {
  const s = `${name || ""} ${symbol || ""}`.toLowerCase();
  return s.includes("domain") || s.includes("name") || s.includes(".zen") || s.includes("zns") || s.includes("ens") || s.includes("dns");
}

export async function fetchAndClassifyDirect(params: {
  address: string;
  from: number;
  to: number;
  onProgress?: (s: string) => void;
  signal?: AbortSignal;
}) {
  const { address, from, to, onProgress, signal } = params;
  const addr = address.toLowerCase();

  // Pass 1: desc pages until we cross start or run out
  const passDesc = await fetchCompatWindowPaged(addr, from, to, "desc", (s)=>onProgress?.(s), signal);
  // Pass 2: asc pages to catch any missed early pages at the boundary
  const passAsc = await fetchCompatWindowPaged(addr, from, to, "asc", (s)=>onProgress?.(s), signal);

  // Merge, dedupe, filter, sort
  const seen = new Set<string>();
  const rows = [...passDesc, ...passAsc]
    .filter(t => (t.hash && !seen.has(t.hash) ? (seen.add(t.hash), true) : false))
    .filter(t => t.timeStamp >= from && t.timeStamp <= to)
    .sort((a, b) => b.timeStamp - a.timeStamp);

  // Fast classification
  let enriched: Enriched[] = rows.map(tx => {
    const direction = dirOf(tx, addr);
    const cat = classifyFast(tx, addr);
    return { ...tx, direction, category: cat, amountNative: weiToEther(tx.valueWei) };
  });

  // Refine “other” with logs (NFT/domain mint detection) — limited + throttled
  const candidates = enriched.filter(e => e.category === "other" && e.direction === "out").slice(0, LOGS_LIMIT);
  if (candidates.length) {
    onProgress?.(`Checking logs (${candidates.length})`);
    let i = 0, active = 0;
    await new Promise<void>((resolve) => {
      const next = () => {
        if (i >= candidates.length && active === 0) return resolve();
        while (active < LOGS_CONCURRENCY && i < candidates.length) {
          const idx = i++;
          const t = candidates[idx];
          active++;
          fetchTxLogs(t.hash, signal).then(async (logs) => {
            for (const l of logs) {
              const topic0 = l.topics?.[0];
              // ERC-721 / ERC-20 Transfer
              if (topic0 === "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef") {
                const fromA = "0x" + (l.topics?.[1]?.slice(26) || "");
                const toA = "0x" + (l.topics?.[2]?.slice(26) || "");
                if (fromA === ZERO && toA.toLowerCase() === addr) {
                  const info = await fetchTokenInfo(l.address, signal).catch(() => ({} as TokenInfo));
                  const typeUpper = String(info.type || "").toUpperCase();
                  if (typeUpper.includes("721")) {
                    const isDomain = looksLikeDomainToken(info.name, info.symbol);
                    t.category = isDomain ? "domain_mint" : "nft_mint";
                    t.logsChecked = true;
                    break;
                  }
                }
              }
              // ERC-1155 TransferSingle
              if (topic0 === "0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62") {
                const fromA = "0x" + (l.topics?.[2]?.slice(26) || "");
                const toA = "0x" + (l.topics?.[3]?.slice(26) || "");
                if (fromA === ZERO && toA.toLowerCase() === addr) {
                  const info = await fetchTokenInfo(l.address, signal).catch(() => ({} as TokenInfo));
                  const typeUpper = String(info.type || "").toUpperCase();
                  if (typeUpper.includes("1155") || typeUpper.includes("721")) {
                    const isDomain = looksLikeDomainToken(info.name, info.symbol);
                    t.category = isDomain ? "domain_mint" : "nft_mint";
                    t.logsChecked = true;
                    break;
                  }
                }
              }
            }
            active--; next();
          }).catch(() => { active--; next(); });
        }
      };
      next();
    });

    // Apply refined categories
    const mapRef = new Map(enriched.map(e => [e.hash, e]));
    for (const c of candidates) {
      const target = mapRef.get(c.hash);
      if (target) { target.category = c.category; target.logsChecked = c.logsChecked; }
    }
    enriched = Array.from(mapRef.values()).sort((a,b)=>b.timeStamp-a.timeStamp);
  }

  // Counts (Direction: Out)
  const counts: Record<string, number> = {};
  for (const e of enriched) {
    if (e.direction !== "out") continue;
    counts[e.category] = (counts[e.category] || 0) + 1;
  }

  return { enriched, counts, mergedCount: rows.length };
}