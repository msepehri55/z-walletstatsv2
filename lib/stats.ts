import { CATEGORY_ORDER } from "./constants";
import { fetchAddressTransactions } from "./adapter";
import { classifyTransaction, buildCategoryCountsOut } from "./classifier";
import { AddressStats, TxEnriched } from "./types";

export async function computeAddressStats(address: string, fromMs?: number, toMs?: number): Promise<AddressStats> {
  const { source, items } = await fetchAddressTransactions(address, fromMs || undefined, toMs || undefined);

  const enriched: TxEnriched[] = [];
  for (const tx of items) {
    const e = await classifyTransaction(tx, address, { fetchLogsIfNeeded: false });
    enriched.push(e);
  }

  const unknownsIdx = enriched.map((t, i) => (t.category === "other" ? i : -1)).filter(i => i >= 0);
  const CHUNK = 8;
  for (let i = 0; i < unknownsIdx.length; i += CHUNK) {
    const slice = unknownsIdx.slice(i, i + CHUNK);
    await Promise.all(
      slice.map(async (idx) => {
        const refined = await classifyTransaction(items[idx], address, { fetchLogsIfNeeded: true });
        enriched[idx] = refined;
      })
    );
  }

  enriched.sort((a, b) => b.timeStamp - a.timeStamp);

  const totals = {
    txAll: enriched.length,
    txOut: enriched.filter(t => t.direction === "out").length,
    txIn: enriched.filter(t => t.direction !== "out").length,
    txFailed: enriched.filter(t => t.status === 0).length
  };

  const countsByCategoryOut = buildCategoryCountsOut(enriched);
  for (const c of CATEGORY_ORDER) countsByCategoryOut[c] = countsByCategoryOut[c] || 0;

  return {
    address,
    from: fromMs || 0,
    to: toMs || Date.now(),
    totals,
    countsByCategoryOut,
    transactions: enriched,
    source,
    debug: { compatTried: true, restTried: source !== "compat" }
  };
}