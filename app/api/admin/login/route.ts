import { NextRequest, NextResponse } from "next/server";
import { Auth } from "@/lib/auth";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const user = (body.username || "").trim();
  const pass = (body.password || "").trim();

  if (!user || !pass) {
    return NextResponse.json({ error: "Missing credentials" }, { status: 400 });
  }

  const ok = user === (process.env.ADMIN_USER || "admin") && pass === (process.env.ADMIN_PASS || "password");
  if (!ok) return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });

  const token = await Auth.sign({ u: user });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(Auth.cookieName, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 2
  });
  return res;
}