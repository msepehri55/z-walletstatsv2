import { NextRequest, NextResponse } from "next/server";
import { ADMIN_CREDENTIALS } from "@/lib/adminConfig";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { username, password } = await req.json().catch(() => ({}));
  if (!username || !password) return NextResponse.json({ error: "Missing credentials" }, { status: 400 });
  if (username !== ADMIN_CREDENTIALS.username || password !== ADMIN_CREDENTIALS.password) {
    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  // Not secure in dev; Vercel is HTTPS so it's fine there
  res.cookies.set("zen_admin", "1", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 });
  return res;
}