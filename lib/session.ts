import { createHash, randomBytes } from "node:crypto"
import { cookies } from "next/headers"
import { createSession, deleteSession, userForSession } from "@/lib/db"

const COOKIE = "harbor_session"
const MAX_AGE = 60 * 60 * 24 * 30

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

export async function readUser() {
  const jar = await cookies()
  const token = jar.get(COOKIE)?.value
  if (!token) return null
  return userForSession(hashToken(token)) ?? null
}

export async function startSession(userId: string) {
  const token = randomBytes(32).toString("hex")
  createSession(hashToken(token), userId, Date.now() + MAX_AGE * 1000)
  const jar = await cookies()
  jar.set(COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: MAX_AGE })
}

export async function endSession() {
  const jar = await cookies()
  const token = jar.get(COOKIE)?.value
  if (token) deleteSession(hashToken(token))
  jar.delete(COOKIE)
}
