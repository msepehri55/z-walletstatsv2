import { NextRequest, NextResponse } from "next/server";
import { Auth } from "@/lib/auth";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(Auth.cookieName)?.value;
  const payload = await Auth.verify(token);
  if (!payload) return NextResponse.json({ authorized: false });
  return NextResponse.json({ authorized: true, user: payload.u || "admin" });
}