import { explorerCompatTxList, explorerRestV2AddressTxPage } from "./explorer";
import { TxBasic } from "./types";

function hexifyMethodId(input: string | undefined) {
  if (!input) return undefined;
  const id = input.slice(0, 10);
  if (!id.startsWith("0x")) return "0x" + id;
  return id;
}

function safeNum(x: any): number {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

// Normalize compat result row into TxBasic
function mapCompatRow(row: any): TxBasic {
  const sec =
    safeNum(row.timeStamp) ||
    safeNum(row.timeStampSec) ||
    safeNum(row.timestamp) ||
    Math.floor(safeNum(row.timeStampMs) / 1000);

  const isOk =
    row.txreceipt_status === "1" ||
    row.isError === "0" ||
    row.isError === 0 ||
    row.status === "1" ||
    row.success === true;

  const gasUsed = String(row.gasUsed || "0");
  const gasPrice = String(row.gasPrice || "0");
  let feeWei: string | undefined;
  try { feeWei = String(BigInt(gasUsed) * BigInt(gasPrice)); } catch { feeWei = undefined; }

  return {
    hash: String(row.hash || row.txhash || "").toLowerCase(),
    blockNumber: safeNum(row.blockNumber || row.block_number),
    timeStamp: sec * 1000,
    from: String(row.from || "").toLowerCase(),
    to: row.to ? String(row.to).toLowerCase() : null,
    valueWei: String(row.value ?? "0"),
    input: row.input || "0x",
    methodId: hexifyMethodId(row.input || row.methodId),
    status: (isOk ? 1 : 0) as 0 | 1,
    gasUsed,
    gasPrice,
    feeWei
  };
}

// Normalize rest v2 row into TxBasic
function mapRestV2Row(row: any): TxBasic {
  const status = row.status === "ok" || row.status === "ok:confirmed" || row.success ? 1 : 0;
  const toHash = row.to?.hash || row.to || null;
  const fromHash = row.from?.hash || row.from || null;
  const input = row.input || row.data || "0x";
  const methodId = input ? input.slice(0, 10) : undefined;

  const tsSec = row.timestamp
    ? Number(row.timestamp)
    : row.time
    ? Number(row.time)
    : row.block?.timestamp
    ? Number(row.block.timestamp)
    : 0;

  const gasUsed = String(row.gas_used ?? row.gasUsed ?? "0");
  const gasPrice = String(row.gas_price ?? row.gasPrice ?? "0");
  let feeWei: string | undefined;
  try { feeWei = row.fee ? String(row.fee) : String(BigInt(gasUsed) * BigInt(gasPrice)); } catch { feeWei = undefined; }

  return {
    hash: String(row.hash || "").toLowerCase(),
    blockNumber: Number(row.block_number || row.blockNumber || row.block?.number || 0),
    timeStamp: (Number.isFinite(tsSec) ? tsSec : 0) * 1000,
    from: String(fromHash || "").toLowerCase(),
    to: toHash ? String(toHash).toLowerCase() : null,
    valueWei: String(row.value ?? row.value_written ?? "0"),
    input,
    methodId,
    status: (status ? 1 : 0) as 0 | 1,
    gasUsed,
    gasPrice,
    feeWei,
    contractAddress: row.created_contract?.address_hash || null
  };
}

export async function fetchAddressTransactions(address: string, fromMs?: number, toMs?: number) {
  // Query both sources in parallel for speed and resilience
  const compatP = explorerCompatTxList({
    address,
    start: fromMs,
    end: toMs,
    sort: "desc",
    page: 1,
    offset: 10000
  }).then(r => {
    const items = (r.ok && Array.isArray(r.result)) ? r.result.map(mapCompatRow) : [];
    return { ok: r.ok, items };
  }).catch(() => ({ ok: false, items: [] }));

  // Fetch up to 3 pages from REST v2 (early-stop if older than fromMs)
  const restP = (async () => {
    let page = 1;
    const PAGE_SIZE = 100;
    const out: TxBasic[] = [];
    for (; page <= 3; page++) {
      const r = await explorerRestV2AddressTxPage({ address, page, offset: PAGE_SIZE });
      if (!r.ok) break;
      const items = (r.result || []).map(mapRestV2Row);
      out.push(...items);
      const oldest = items[items.length - 1]?.timeStamp || 0;
      if (!items.length || (fromMs && oldest < fromMs)) break;
    }
    return { ok: out.length > 0, items: out };
  })().catch(() => ({ ok: false, items: [] }));

  const [compatRes, restRes] = await Promise.all([compatP, restP]);

  let source: "compat" | "restv2" | "mixed" = "compat";
  let rows: TxBasic[] = [];

  if (compatRes.ok && compatRes.items.length) {
    rows = compatRes.items;
    source = "compat";
  } else if (restRes.ok && restRes.items.length) {
    rows = restRes.items;
    source = "restv2";
  } else {
    // Both empty or failed — return empty set (no throw) to avoid UI hang
    rows = [];
    source = compatRes.ok || restRes.ok ? "mixed" : "restv2";
  }

  // Filter by time range (compat already filtered; rest might not)
  rows = rows.filter((t: any) => {
    const ts = Number(t.timeStamp || 0);
    if (fromMs && ts < fromMs) return false;
    if (toMs && ts > toMs) return false;
    return true;
  });

  // Dedupe by hash
  const seen = new Set<string>();
  const deduped = rows.filter((t: any) => {
    if (seen.has(t.hash)) return false;
    seen.add(t.hash);
    return true;
  }) as TxBasic[];

  return { source, items: deduped };
}