import { createServerFn } from "@tanstack/react-start";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getSql } from "./db.js";
import { getCurrentSession } from "./session.js";

const SignupInput = z.object({
  email: z.string().email().max(255),
  password: z.string().min(6).max(200),
  name: z.string().min(1).max(100),
});

export const signup = createServerFn({ method: "POST" })
  .inputValidator((d) => SignupInput.parse(d))
  .handler(async ({ data }) => {
    const sql = getSql();
    const email = data.email.toLowerCase().trim();
    const existing = await sql`SELECT id FROM users WHERE email = ${email}`;
    if (existing.length > 0) {
      throw new Error("An account with that email already exists");
    }
    const hash = await bcrypt.hash(data.password, 10);
    const rows = await sql`
      INSERT INTO users (email, password_hash, name)
      VALUES (${email}, ${hash}, ${data.name})
      RETURNING id, email, name
    `;
    const user = rows[0];
    const session = await getCurrentSession();
    await session.update({ userId: user.id, email: user.email, name: user.name });
    return { user };
  });

const LoginInput = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const login = createServerFn({ method: "POST" })
  .inputValidator((d) => LoginInput.parse(d))
  .handler(async ({ data }) => {
    const sql = getSql();
    const email = data.email.toLowerCase().trim();
    const rows = await sql`SELECT id, email, name, password_hash FROM users WHERE email = ${email}`;
    if (rows.length === 0) throw new Error("Invalid email or password");
    const u = rows[0];
    const ok = await bcrypt.compare(data.password, u.password_hash);
    if (!ok) throw new Error("Invalid email or password");
    const session = await getCurrentSession();
    await session.update({ userId: u.id, email: u.email, name: u.name });
    return { user: { id: u.id, email: u.email, name: u.name } };
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  const session = await getCurrentSession();
  await session.clear();
  return { ok: true };
});

export const me = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const session = await getCurrentSession();
    if (!session.data?.userId) return { user: null };
    return {
      user: {
        id: session.data.userId,
        email: session.data.email,
        name: session.data.name,
      },
    };
  } catch {
    return { user: null };
  }
});
