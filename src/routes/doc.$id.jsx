import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { me } from "@/lib/auth.functions";
import { getDocument, updateDocument, shareDocument, unshareDocument } from "@/lib/docs.functions";
import Editor from "@/components/Editor.jsx";
import { ArrowLeft, Share2, Check, Loader2, X } from "lucide-react";

export const Route = createFileRoute("/doc/$id")({
  loader: async ({ params }) => {
    const { user } = await me();
    if (!user) throw redirect({ to: "/login" });
    const data = await getDocument({ data: { id: Number(params.id) } });
    return { user, ...data };
  },
  component: DocPage,
});

function DocPage() {
  const { user, document, shares } = Route.useLoaderData();
  const router = useRouter();
  const updateFn = useServerFn(updateDocument);
  const shareFn = useServerFn(shareDocument);
  const unshareFn = useServerFn(unshareDocument);

  const [title, setTitle] = useState(document.title);
  const [content, setContent] = useState(document.content);
  const [status, setStatus] = useState("saved");
  const [showShare, setShowShare] = useState(false);

  const canEdit = document.access === "owner" || document.access === "edit";
  const isOwner = document.access === "owner";

  const debounceRef = useRef(null);
  useEffect(() => {
    if (!canEdit) return;
    if (title === document.title && content === document.content) return;
    setStatus("saving");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        await updateFn({ data: { id: document.id, title, content } });
        setStatus("saved");
      } catch {
        setStatus("error");
      }
    }, 600);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, content]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-20">
        <div className="mx-auto max-w-4xl flex items-center gap-3 px-6 py-3">
          <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Docs
          </Link>
          <input
            value={title}
            disabled={!canEdit}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-1 bg-transparent text-lg font-medium px-2 py-1 rounded hover:bg-muted focus:bg-muted focus:outline-none disabled:opacity-70"
          />
          <span className="text-xs text-muted-foreground inline-flex items-center gap-1 min-w-[80px]">
            {status === "saving" && (<><Loader2 className="h-3 w-3 animate-spin" /> Saving…</>)}
            {status === "saved" && (<><Check className="h-3 w-3" /> Saved</>)}
            {status === "error" && <span className="text-destructive">Save failed</span>}
          </span>
          {!canEdit && <span className="text-xs px-2 py-1 rounded bg-muted">View only</span>}
          {isOwner && (
            <button onClick={() => setShowShare(true)} className="inline-flex items-center gap-1 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm">
              <Share2 className="h-4 w-4" /> Share
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-6">
        {!isOwner && (
          <p className="mb-3 text-xs text-muted-foreground">
            Owned by {document.owner_name} · You have {document.access} access
          </p>
        )}
        <Editor value={content} onChange={setContent} editable={canEdit} />
      </main>

      {showShare && isOwner && (
        <ShareDialog
          docId={document.id}
          shares={shares}
          onClose={() => { setShowShare(false); router.invalidate(); }}
          shareFn={shareFn}
          unshareFn={unshareFn}
        />
      )}
    </div>
  );
}

function ShareDialog({ docId, shares, onClose, shareFn, unshareFn }) {
  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState("edit");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [localShares, setLocalShares] = useState(shares);

  async function onShare(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await shareFn({ data: { id: docId, email, permission } });
      setEmail("");
      setLocalShares([
        ...localShares.filter((s) => s.email !== email.toLowerCase()),
        { email: email.toLowerCase(), name: email, permission, id: Math.random() },
      ]);
    } catch (err) {
      setError(err?.message || "Failed to share");
    } finally {
      setBusy(false);
    }
  }

  async function onRemove(userId) {
    await unshareFn({ data: { id: docId, userId } });
    setLocalShares(localShares.filter((s) => s.id !== userId));
  }

  return (
    <div className="fixed inset-0 z-30 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-xl bg-card border border-border p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Share document</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={onShare} className="space-y-3">
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@email.com" className="w-full rounded-md border border-input bg-background px-3 py-2" />
          <div className="flex gap-2">
            <select value={permission} onChange={(e) => setPermission(e.target.value)} className="rounded-md border border-input bg-background px-2 py-2 text-sm">
              <option value="edit">Can edit</option>
              <option value="view">Can view</option>
            </select>
            <button disabled={busy} className="flex-1 rounded-md bg-primary text-primary-foreground py-2 text-sm font-medium disabled:opacity-50">
              {busy ? "Sharing…" : "Share"}
            </button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <p className="text-xs text-muted-foreground">The recipient must already have an account with that email.</p>
        </form>
        <div className="mt-5">
          <h4 className="text-sm font-medium mb-2">People with access</h4>
          {localShares.length === 0 ? (
            <p className="text-xs text-muted-foreground">Just you.</p>
          ) : (
            <ul className="space-y-1">
              {localShares.map((s) => (
                <li key={s.id} className="flex items-center justify-between text-sm rounded-md px-2 py-1 hover:bg-muted">
                  <div className="min-w-0">
                    <div className="truncate">{s.name} <span className="text-muted-foreground">({s.email})</span></div>
                    <div className="text-xs text-muted-foreground">{s.permission}</div>
                  </div>
                  <button onClick={() => onRemove(s.id)} className="text-xs text-destructive hover:underline">Remove</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}