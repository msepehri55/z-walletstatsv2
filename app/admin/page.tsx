import { cookies } from "next/headers";
import AdminLogin from "@/components/AdminLogin";
import AdminClient from "@/components/AdminClient";
import { Auth } from "@/lib/auth";

export default async function AdminPage() {
  const token = cookies().get(Auth.cookieName)?.value;
  const payload = await Auth.verify(token);
  const authorized = !!payload;

  if (!authorized) {
    return (
      <div className="space-y-6">
        <div className="card p-6">
          <h1 className="text-2xl font-semibold">ZenStats — Admin</h1>
          <p className="text-zen-sub mt-2">Sign in to access the admin tools.</p>
        </div>
        <AdminLogin />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminClient />
    </div>
  );
}