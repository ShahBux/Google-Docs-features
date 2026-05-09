import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { login } from "@/lib/auth.functions";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const loginFn = useServerFn(login);
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await loginFn({ data: form });
      navigate({ to: "/dashboard" });
    } catch (err) {
      setError(err?.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <input className="w-full rounded-md border border-input bg-background px-3 py-2" type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        <input className="w-full rounded-md border border-input bg-background px-3 py-2" type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <button disabled={busy} className="w-full rounded-md bg-primary text-primary-foreground py-2 font-medium disabled:opacity-50">
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <p className="text-sm text-muted-foreground text-center">
          New here? <Link to="/signup" className="underline">Create an account</Link>
        </p>
      </form>
    </div>
  );
}