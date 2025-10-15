import { NextRequest, NextResponse } from "next/server";
import { Auth } from "@/lib/auth";

export const runtime = "edge";

function toCsvUrl(link: string) {
  try {
    const u = new URL(link);
    if (u.hostname.includes("docs.google.com") && u.pathname.includes("/spreadsheets/")) {
      // Convert to CSV export
      // /spreadsheets/d/<id>/edit#gid=0  -> /spreadsheets/d/<id>/export?format=csv&gid=<gid>
      const m = u.pathname.match(/\/spreadsheets\/d\/([^/]+)/);
      const id = m?.[1];
      const gid = u.hash?.includes("gid=") ? u.hash.split("gid=")[1] : u.searchParams.get("gid") || "0";
      if (id) return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
    }
    return link;
  } catch {
    return link;
  }
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get(Auth.cookieName)?.value;
  const payload = await Auth.verify(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url") || "";
  if (!url) return NextResponse.json({ error: "Missing url" }, { status: 400 });

  const csvUrl = toCsvUrl(url);
  const res = await fetch(csvUrl, { cache: "no-store" });
  if (!res.ok) return NextResponse.json({ error: `Fetch failed (${res.status})` }, { status: 400 });
  const text = await res.text();
  return new NextResponse(text, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" }
  });
}