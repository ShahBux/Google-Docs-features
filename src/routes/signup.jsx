import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { signup } from "@/lib/auth.functions";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const signupFn = useServerFn(signup);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      // FIX: Wrap the form data in a data property
      await signupFn({ data: form });
      navigate({ to: "/dashboard" });
    } catch (err) {
      setError(err?.message || "Signup failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
        <h1 className="text-2xl font-semibold">Create your account</h1>
        <p className="text-sm text-muted-foreground">Free. No credit card.</p>
        <input 
          className="w-full rounded-md border border-input bg-background px-3 py-2" 
          placeholder="Your name" 
          value={form.name} 
          onChange={(e) => setForm({ ...form, name: e.target.value })} 
          required 
        />
        <input 
          className="w-full rounded-md border border-input bg-background px-3 py-2" 
          type="email" 
          placeholder="Email" 
          value={form.email} 
          onChange={(e) => setForm({ ...form, email: e.target.value })} 
          required 
        />
        <input 
          className="w-full rounded-md border border-input bg-background px-3 py-2" 
          type="password" 
          placeholder="Password (6+ chars)" 
          minLength={6} 
          value={form.password} 
          onChange={(e) => setForm({ ...form, password: e.target.value })} 
          required 
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <button 
          disabled={busy} 
          className="w-full rounded-md bg-primary text-primary-foreground py-2 font-medium disabled:opacity-50"
        >
          {busy ? "Creating…" : "Sign up"}
        </button>
        <p className="text-sm text-muted-foreground text-center">
          Have an account? <Link to="/login" className="underline">Sign in</Link>
        </p>
      </form>
    </div>
  );
}