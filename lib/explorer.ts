import { ENDPOINTS } from "./constants";
import { memoryCache } from "./cache";

type AnyObj = Record<string, any>;

const compat = ENDPOINTS.explorerCompatApi;
const restv2 = ENDPOINTS.explorerRestV2;

const DEFAULT_TIMEOUT = Number(process.env.EXPLORER_TIMEOUT_MS || 8000); // 8s

async function fetchJson(url: string, timeoutMs = DEFAULT_TIMEOUT) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "accept": "application/json",
        "user-agent": "ZenStats/1.0 (+https://github.com/)"
      },
      signal: ctrl.signal,
      cache: "no-store"
    });
    const status = res.status;
    let data: any = null;
    try {
      data = await res.json();
    } catch {
      // not JSON
      data = null;
    }
    return { ok: res.ok, status, data };
  } catch (e: any) {
    return { ok: false, status: 0, data: null, error: e?.message || "fetch failed" };
  } finally {
    clearTimeout(t);
  }
}

export async function explorerCompatTxList(params: {
  address: string;
  start?: number; // ms
  end?: number;   // ms
  sort?: "asc" | "desc";
  page?: number;
  offset?: number;
}) {
  const { address, start, end, sort = "desc", page = 1, offset = 10000 } = params;
  const qs = new URLSearchParams({
    module: "account",
    action: "txlist",
    address,
    sort,
    page: String(page),
    offset: String(offset)
  });
  if (start) qs.set("starttimestamp", String(Math.floor(start / 1000)));
  if (end) qs.set("endtimestamp", String(Math.floor(end / 1000)));
  const url = `${compat}?${qs.toString()}`;
  const r = await fetchJson(url);
  if (!r.ok || !r.data) return { ok: false, result: [], raw: r };
  const arr = Array.isArray(r.data.result) ? r.data.result : [];
  return { ok: true, result: arr as AnyObj[], raw: r.data };
}

export async function explorerCompatTokenNFTTx(params: {
  address: string;
  start?: number;
  end?: number;
}) {
  const { address, start, end } = params;
  const qs = new URLSearchParams({
    module: "account",
    action: "tokennfttx",
    address,
    sort: "desc",
    page: "1",
    offset: "10000"
  });
  if (start) qs.set("starttimestamp", String(Math.floor(start / 1000)));
  if (end) qs.set("endtimestamp", String(Math.floor(end / 1000)));
  const url = `${compat}?${qs.toString()}`;
  const r = await fetchJson(url);
  if (!r.ok || !r.data) return { ok: false, result: [], raw: r };
  const arr = Array.isArray(r.data.result) ? r.data.result : [];
  return { ok: true, result: arr as AnyObj[], raw: r.data };
}

export async function explorerCompatToken1155Tx(params: {
  address: string;
  start?: number;
  end?: number;
}) {
  const { address, start, end } = params;
  const qs = new URLSearchParams({
    module: "account",
    action: "token1155tx",
    address,
    sort: "desc",
    page: "1",
    offset: "10000"
  });
  if (start) qs.set("starttimestamp", String(Math.floor(start / 1000)));
  if (end) qs.set("endtimestamp", String(Math.floor(end / 1000)));
  const url = `${compat}?${qs.toString()}`;
  const r = await fetchJson(url);
  if (!r.ok || !r.data) return { ok: false, result: [], raw: r };
  const arr = Array.isArray(r.data.result) ? r.data.result : [];
  return { ok: true, result: arr as AnyObj[], raw: r.data };
}

export async function explorerRestV2AddressTxPage(params: {
  address: string;
  page?: number;
  offset?: number;
}) {
  const { address, page = 1, offset = 50 } = params;
  const url = `${restv2}/addresses/${address}/transactions?filter=to%7Cfrom&items=${offset}&page=${page}`;
  const r = await fetchJson(url);
  if (!r.ok || !r.data) return { ok: false, result: [], raw: r };
  const items = Array.isArray(r.data?.items) ? r.data.items : [];
  return { ok: true, result: items as AnyObj[], raw: r.data };
}

export async function explorerTxLogs(hash: string) {
  const key = `txLogs:${hash}`;
  const cached = memoryCache.get(key);
  if (cached) return cached;
  const url = `${restv2}/transactions/${hash}/logs`;
  const r = await fetchJson(url);
  const items = Array.isArray(r.data?.items) ? r.data.items : [];
  memoryCache.set(key, items, { ttl: 60_000 });
  return items as AnyObj[];
}

export async function explorerTokenInfo(address: string) {
  const key = `tokenInfo:${address.toLowerCase()}`;
  const cached = memoryCache.get(key);
  if (cached) return cached;
  const url = `${restv2}/tokens/${address}`;
  const r = await fetchJson(url, 10_000);
  const info = {
    address: ((r.data?.address?.hash || address) as string).toLowerCase(),
    name: r.data?.name,
    symbol: r.data?.symbol,
    type: r.data?.type
  };
  memoryCache.set(key, info, { ttl: 10 * 60_000 });
  return info;
}