"use client";

import { useState } from "react";

export default function AdminLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Login failed");
      window.location.reload();
    } catch (e: any) {
      setErr(e?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto card p-6">
      <h2 className="text-xl font-semibold">Admin Login</h2>
      <form className="mt-4 space-y-3" onSubmit={onSubmit}>
        <div>
          <label className="block text-sm text-zen-sub mb-1">Username</label>
          <input className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 outline-none focus:border-zen-accent"
                 value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm text-zen-sub mb-1">Password</label>
          <input type="password" className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 outline-none focus:border-zen-accent"
                 value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {err && <div className="text-rose-400 text-sm">{err}</div>}
        <button className="btn w-full" disabled={loading}>{loading ? "Signing in…" : "Sign in"}</button>
      </form>
    </div>
  );
}