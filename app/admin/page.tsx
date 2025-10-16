import { cookies } from "next/headers";

export default async function AdminPage() {
  const authed = cookies().get("zen_admin")?.value === "1";

  if (!authed) {
    return (
      <div className="max-w-sm mx-auto card p-6">
        <h2 className="text-lg font-semibold">Admin Login</h2>
        <form
          className="space-y-3 mt-4"
          action={async (formData) => {
            "use server";
          }}
        >
          <div>
            <label className="block text-xs text-zen-sub mb-1">Username</label>
            <input name="username" id="admin-username" className="w-full bg-[#0c1628] border border-white/10 rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-xs text-zen-sub mb-1">Password</label>
            <input type="password" name="password" id="admin-password" className="w-full bg-[#0c1628] border border-white/10 rounded-lg px-3 py-2" />
          </div>
          <button
            onClick={async (e) => {
              e.preventDefault();
              const u = (document.getElementById("admin-username") as HTMLInputElement)?.value || "";
              const p = (document.getElementById("admin-password") as HTMLInputElement)?.value || "";
              const r = await fetch("/api/admin/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: u, password: p }) });
              if (r.ok) window.location.reload();
              else alert("Invalid username or password");
            }}
            className="btn w-full"
          >
            Sign in
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <div className="flex items-center gap-3">
        <div className="text-lg font-semibold">Admin</div>
        <div className="ml-auto">
          <button
            className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 text-xs"
            onClick={async () => { await fetch("/api/admin/logout", { method: "POST" }); window.location.reload(); }}
          >
            Logout
          </button>
        </div>
      </div>
      <div className="text-zen-sub text-sm mt-2">Welcome. (Hook your admin tools here.)</div>
    </div>
  );
}