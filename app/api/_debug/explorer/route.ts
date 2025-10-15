import { NextRequest, NextResponse } from "next/server";
import { explorerCompatTxList, explorerRestV2AddressTxPage } from "@/lib/explorer";

export const runtime = "nodejs";

function extractAddress(input: string) {
  const m = (input || "").match(/0x[0-9a-fA-F]{40}/);
  return m ? m[0].toLowerCase() : "";
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const raw = (searchParams.get("address") || "").trim();
  const address = extractAddress(raw);
  const from = Number(searchParams.get("from") || "0");
  const to = Number(searchParams.get("to") || Date.now());

  if (!address) return NextResponse.json({ error: "Invalid address" }, { status: 400 });

  const resp: any = { address, from, to };

  try {
    const compat = await explorerCompatTxList({ address, start: from || undefined, end: to || undefined, sort: "desc", page: 1, offset: 25 });
    resp.compatOk = compat.ok;
    resp.compatCount = compat.result?.length || 0;
  } catch (e: any) {
    resp.compatErr = e?.message || "compat failed";
  }

  try {
    const rest = await explorerRestV2AddressTxPage({ address, page: 1, offset: 25 });
    resp.restOk = rest.ok;
    resp.restCount = rest.result?.length || 0;
  } catch (e: any) {
    resp.restErr = e?.message || "rest failed";
  }

  return NextResponse.json(resp, { headers: { "Cache-Control": "no-store" } });
}