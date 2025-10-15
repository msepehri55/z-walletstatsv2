import { NextResponse } from "next/server";
export const runtime = "nodejs";
export async function GET() {
  return NextResponse.json({ ok: true, now: Date.now() }, { headers: { "Cache-Control": "no-store" } });
}