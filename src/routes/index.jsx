import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { me } from "@/lib/auth.functions";

export const Route = createFileRoute("/")({
  loader: async () => {
    const { user } = await me();
    if (user) throw redirect({ to: "/dashboard" });
    return {};
  },
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-6 py-4">
          <div className="font-semibold tracking-tight">Ajaia Docs</div>
          <nav className="flex items-center gap-2 text-sm">
            <Link to="/login" className="px-3 py-1.5 rounded-md hover:bg-muted">Sign in</Link>
            <Link to="/signup" className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90">Get started</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="text-5xl font-bold tracking-tight">A lightweight collaborative editor.</h1>
        <p className="mt-5 text-lg text-muted-foreground">
          Create rich-text documents, import .txt / .md / .docx files, and share them with teammates.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link to="/signup" className="px-5 py-2.5 rounded-md bg-primary text-primary-foreground font-medium">Create free account</Link>
          <Link to="/login" className="px-5 py-2.5 rounded-md border border-border">Sign in</Link>
        </div>
      </main>
    </div>
  );
}