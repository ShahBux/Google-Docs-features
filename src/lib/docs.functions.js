import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "./db.js";
import { requireUserId } from "./session.js";

async function assertCanEdit(sql, docId, userId) {
  const rows = await sql`
    SELECT d.id, d.owner_id,
      CASE WHEN d.owner_id = ${userId} THEN 'owner'
           ELSE s.permission END AS access
    FROM documents d
    LEFT JOIN document_shares s ON s.document_id = d.id AND s.user_id = ${userId}
    WHERE d.id = ${docId}
  `;
  if (rows.length === 0) throw new Error("Document not found");
  const access = rows[0].access;
  if (access !== "owner" && access !== "edit") throw new Error("No access");
  return rows[0];
}

export const listDocuments = createServerFn({ method: "GET" }).handler(async () => {
  const userId = await requireUserId();
  const sql = getSql();
  const owned = await sql`
    SELECT id, title, updated_at FROM documents
    WHERE owner_id = ${userId}
    ORDER BY updated_at DESC
  `;
  const shared = await sql`
    SELECT d.id, d.title, d.updated_at, u.name AS owner_name, s.permission
    FROM document_shares s
    JOIN documents d ON d.id = s.document_id
    JOIN users u ON u.id = d.owner_id
    WHERE s.user_id = ${userId}
    ORDER BY d.updated_at DESC
  `;
  return { owned, shared };
});

export const createDocument = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    title: z.string().min(1).max(200).default("Untitled"),
    content: z.string().max(2_000_000).default(""),
  }).parse(d ?? {}))
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    const sql = getSql();
    const rows = await sql`
      INSERT INTO documents (owner_id, title, content)
      VALUES (${userId}, ${data.title}, ${data.content})
      RETURNING id, title, content, updated_at
    `;
    return { document: rows[0] };
  });

export const getDocument = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ id: z.coerce.number().int().positive() }).parse(d))
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    const sql = getSql();
    const rows = await sql`
      SELECT d.id, d.title, d.content, d.updated_at, d.owner_id,
        u.name AS owner_name, u.email AS owner_email,
        CASE WHEN d.owner_id = ${userId} THEN 'owner'
             ELSE s.permission END AS access
      FROM documents d
      JOIN users u ON u.id = d.owner_id
      LEFT JOIN document_shares s ON s.document_id = d.id AND s.user_id = ${userId}
      WHERE d.id = ${data.id}
    `;
    if (rows.length === 0) throw new Error("Document not found");
    const doc = rows[0];
    if (!doc.access) throw new Error("No access");
    let shares = [];
    if (doc.access === "owner") {
      shares = await sql`
        SELECT u.id, u.email, u.name, s.permission
        FROM document_shares s JOIN users u ON u.id = s.user_id
        WHERE s.document_id = ${data.id}
      `;
    }
    return { document: doc, shares };
  });

export const updateDocument = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    id: z.coerce.number().int().positive(),
    title: z.string().min(1).max(200).optional(),
    content: z.string().max(2_000_000).optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    const sql = getSql();
    await assertCanEdit(sql, data.id, userId);
    if (data.title !== undefined && data.content !== undefined) {
      await sql`UPDATE documents SET title = ${data.title}, content = ${data.content}, updated_at = now() WHERE id = ${data.id}`;
    } else if (data.title !== undefined) {
      await sql`UPDATE documents SET title = ${data.title}, updated_at = now() WHERE id = ${data.id}`;
    } else if (data.content !== undefined) {
      await sql`UPDATE documents SET content = ${data.content}, updated_at = now() WHERE id = ${data.id}`;
    }
    return { ok: true };
  });

export const deleteDocument = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.coerce.number().int().positive() }).parse(d))
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    const sql = getSql();
    const rows = await sql`SELECT owner_id FROM documents WHERE id = ${data.id}`;
    if (rows.length === 0) throw new Error("Not found");
    if (Number(rows[0].owner_id) !== userId) throw new Error("Only the owner can delete");
    await sql`DELETE FROM documents WHERE id = ${data.id}`;
    return { ok: true };
  });

export const shareDocument = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    id: z.coerce.number().int().positive(),
    email: z.string().email(),
    permission: z.enum(["view", "edit"]).default("edit"),
  }).parse(d))
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    const sql = getSql();
    const own = await sql`SELECT owner_id FROM documents WHERE id = ${data.id}`;
    if (own.length === 0) throw new Error("Not found");
    if (Number(own[0].owner_id) !== userId) throw new Error("Only the owner can share");
    const target = await sql`SELECT id FROM users WHERE email = ${data.email.toLowerCase().trim()}`;
    if (target.length === 0) throw new Error("No user with that email has signed up yet");
    const targetId = target[0].id;
    if (Number(targetId) === userId) throw new Error("You already own this document");
    await sql`
      INSERT INTO document_shares (document_id, user_id, permission)
      VALUES (${data.id}, ${targetId}, ${data.permission})
      ON CONFLICT (document_id, user_id) DO UPDATE SET permission = EXCLUDED.permission
    `;
    return { ok: true };
  });

export const unshareDocument = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    id: z.coerce.number().int().positive(),
    userId: z.coerce.number().int().positive(),
  }).parse(d))
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    const sql = getSql();
    const own = await sql`SELECT owner_id FROM documents WHERE id = ${data.id}`;
    if (own.length === 0 || Number(own[0].owner_id) !== userId) throw new Error("Forbidden");
    await sql`DELETE FROM document_shares WHERE document_id = ${data.id} AND user_id = ${data.userId}`;
    return { ok: true };
  });