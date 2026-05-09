import { useSession } from "@tanstack/react-start/server";

export function sessionConfig() {
  const password = process.env.SESSION_SECRET;
  if (!password || password.length < 32) {
    throw new Error("SESSION_SECRET must be set and at least 32 chars");
  }
  return {
    password,
    name: "ajaia_docs_session",
    maxAge: 60 * 60 * 24 * 30,
    cookie: { httpOnly: true, sameSite: "lax", secure: true, path: "/" },
  };
}

export async function getCurrentSession() {
  return useSession(sessionConfig());
}

export async function requireUserId() {
  const session = await getCurrentSession();
  const userId = session.data?.userId;
  if (!userId) {
    const err = new Error("UNAUTHORIZED");
    err.status = 401;
    throw err;
  }
  return Number(userId);
}