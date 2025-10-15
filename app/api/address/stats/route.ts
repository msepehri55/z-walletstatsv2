import { NextRequest, NextResponse } from "next/server";
import { computeAddressStats } from "@/lib/stats";

function toNum(x: string | null, def: number) {
  if (!x) return def;
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

function extractAddress(input: string) {
  const m = (input || "").match(/0x[0-9a-fA-F]{40}/);
  return m ? m[0].toLowerCase() : "";
}

export const runtime = "nodejs";

// 12s hard budget so local dev never hangs even if Explorer is slow/unreachable
const API_BUDGET_MS = Number(process.env.API_BUDGET_MS || 12_000);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  try {
    const raw = (searchParams.get("address") || "").trim();
    const address = extractAddress(raw);
    if (!address) {
      return NextResponse.json({ error: "Invalid address" }, { status: 400 });
    }
    const fromMs = toNum(searchParams.get("from"), 0);
    const toMs = toNum(searchParams.get("to"), Date.now());

    const timed = await Promise.race([
      computeAddressStats(address, fromMs || undefined, toMs || undefined),
      new Promise((_, reject) => setTimeout(() => reject(new Error("upstream_timeout")), API_BUDGET_MS))
    ]).catch((e: any) => {
      if (String(e?.message) === "upstream_timeout") {
        // Return a valid, empty payload instead of hanging
        return {
          address,
          from: fromMs || 0,
          to: toMs || Date.now(),
          totals: { txAll: 0, txOut: 0, txIn: 0, txFailed: 0 },
          countsByCategoryOut: {
            stake: 0, native_send: 0, nft_mint: 0, domain_mint: 0,
            cc_deploy: 0, cco_deploy: 0, gm: 0, swap: 0,
            add_liquidity: 0, remove_liquidity: 0, approve: 0, fail: 0, other: 0
          },
          transactions: [],
          source: "mixed",
          debug: { compatTried: true, restTried: true, warnings: ["upstream_timeout"] }
        };
      }
      throw e;
    });

    return NextResponse.json(timed, {
      headers: { "Cache-Control": "s-maxage=15, stale-while-revalidate=30" }
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}