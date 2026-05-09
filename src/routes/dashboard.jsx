import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, useRef } from "react";
import { listDocuments, createDocument, deleteDocument } from "@/lib/docs.functions";
import { FileText, Plus, Upload, Trash2, Users, LogOut } from "lucide-react";
import {me, logout } from "../lib/auth.functions";

export const Route = createFileRoute("/dashboard")({
  loader: async () => {
    const { user } = await me();
    if (!user) throw redirect({ to: "/login" });
    const docs = await listDocuments();
    return { user, docs };
  },
  component: Dashboard,
});

function Dashboard() {
  const { user, docs } = Route.useLoaderData();
  const router = useRouter();
  const createFn = useServerFn(createDocument);
  const deleteFn = useServerFn(deleteDocument);
  const logoutFn = useServerFn(logout);
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef(null);

  async function newDoc() {
    setBusy(true);
    try {
      const { document } = await createFn({ data: { title: "Untitled", content: "<p></p>" } });
      router.navigate({ to: "/doc/$id", params: { id: String(document.id) } });
    } finally {
      setBusy(false);
    }
  }

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImporting(true);
    try {
      const name = file.name.replace(/\.[^.]+$/, "") || "Imported";
      let html = "";
      const lower = file.name.toLowerCase();
      if (lower.endsWith(".docx")) {
        const mammoth = await import("mammoth/mammoth.browser.js");
        const buf = await file.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer: buf });
        html = result.value || "<p></p>";
      } else if (lower.endsWith(".md") || lower.endsWith(".markdown")) {
        const text = await file.text();
        html = mdToHtml(text);
      } else if (lower.endsWith(".txt")) {
        const text = await file.text();
        html = text.split(/\n{2,}/).map(p => `<p>${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`).join("");
      } else {
        alert("Unsupported file type. Please upload .txt, .md, or .docx");
        return;
      }
      const { document } = await createFn({ data: { title: name.slice(0, 200), content: html } });
      router.navigate({ to: "/doc/$id", params: { id: String(document.id) } });
    } catch (err) {
      alert("Import failed: " + (err?.message || err));
    } finally {
      setImporting(false);
    }
  }

  async function removeDoc(id) {
    if (!confirm("Delete this document? This cannot be undone.")) return;
    await deleteFn({ data: { id } });
    router.invalidate();
  }

  async function doLogout() {
    await logoutFn({});
    router.navigate({ to: "/login" });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto max-w-5xl flex items-center justify-between px-6 py-4">
          <div className="font-semibold">Ajaia Docs</div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">{user.name} · {user.email}</span>
            <button onClick={doLogout} className="inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-muted">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8 space-y-10">
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Your documents</h2>
            <div className="flex gap-2">
              <input ref={fileRef} type="file" accept=".txt,.md,.markdown,.docx" className="hidden" onChange={onFile} />
              <button onClick={() => fileRef.current?.click()} disabled={importing} className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50">
                <Upload className="h-4 w-4" /> {importing ? "Importing…" : "Import file"}
              </button>
              <button onClick={newDoc} disabled={busy} className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm disabled:opacity-50">
                <Plus className="h-4 w-4" /> New document
              </button>
            </div>
          </div>
          {docs.owned.length === 0 ? (
            <p className="text-sm text-muted-foreground rounded-md border border-dashed border-border p-8 text-center">
              No documents yet — create one or import a file.
            </p>
          ) : (
            <ul className="grid sm:grid-cols-2 gap-3">
              {docs.owned.map((d) => (
                <li key={d.id} className="group rounded-lg border border-border bg-card p-4 hover:shadow-sm transition">
                  <Link to="/doc/$id" params={{ id: String(d.id) }} className="flex items-start gap-3">
                    <FileText className="h-5 w-5 mt-0.5 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{d.title}</div>
                      <div className="text-xs text-muted-foreground">Updated {fmt(d.updated_at)}</div>
                    </div>
                  </Link>
                  <div className="mt-2 flex justify-end">
                    <button onClick={() => removeDoc(d.id)} className="opacity-0 group-hover:opacity-100 text-xs inline-flex items-center gap-1 text-destructive hover:underline">
                      <Trash2 className="h-3 w-3" /> Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Users className="h-5 w-5" /> Shared with you
          </h2>
          {docs.shared.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing shared with you yet.</p>
          ) : (
            <ul className="grid sm:grid-cols-2 gap-3">
              {docs.shared.map((d) => (
                <li key={d.id} className="rounded-lg border border-border bg-card p-4">
                  <Link to="/doc/$id" params={{ id: String(d.id) }} className="flex items-start gap-3">
                    <FileText className="h-5 w-5 mt-0.5 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{d.title}</div>
                      <div className="text-xs text-muted-foreground">
                        Shared by {d.owner_name} · {d.permission} · Updated {fmt(d.updated_at)}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

function fmt(s) { try { return new Date(s).toLocaleString(); } catch { return ""; } }
function escapeHtml(s) { return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function mdToHtml(md) {
  const lines = md.split(/\r?\n/);
  const out = [];
  let inUl = false, inOl = false, para = [];
  const flushPara = () => { if (para.length) { out.push(`<p>${inline(para.join(" "))}</p>`); para = []; } };
  const closeLists = () => { if (inUl) { out.push("</ul>"); inUl = false; } if (inOl) { out.push("</ol>"); inOl = false; } };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { flushPara(); closeLists(); continue; }
    let m;
    if ((m = line.match(/^(#{1,6})\s+(.*)$/))) {
      flushPara(); closeLists();
      const lvl = m[1].length; out.push(`<h${lvl}>${inline(m[2])}</h${lvl}>`); continue;
    }
    if ((m = line.match(/^\s*[-*]\s+(.*)$/))) {
      flushPara();
      if (inOl) { out.push("</ol>"); inOl = false; }
      if (!inUl) { out.push("<ul>"); inUl = true; }
      out.push(`<li>${inline(m[1])}</li>`); continue;
    }
    if ((m = line.match(/^\s*\d+\.\s+(.*)$/))) {
      flushPara();
      if (inUl) { out.push("</ul>"); inUl = false; }
      if (!inOl) { out.push("<ol>"); inOl = true; }
      out.push(`<li>${inline(m[1])}</li>`); continue;
    }
    closeLists();
    para.push(line);
  }
  flushPara(); closeLists();
  return out.join("\n") || "<p></p>";
  function inline(s) {
    s = escapeHtml(s);
    s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    return s;
  }
}