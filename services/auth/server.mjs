import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto"
import { promisify } from "node:util"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { listen } from "../lib/http.mjs"
import { openDb } from "../lib/sqlite.mjs"
import { ports } from "../lib/defaults.mjs"

const scrypt = promisify(scryptCallback)
const MAX_AGE = 60 * 60 * 24 * 30
const db = openDb(
  "auth.db",
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  );`
)

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex")
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex")
  const derived = await scrypt(password, salt, 32)
  return `${salt}:${derived.toString("hex")}`
}

async function verifyPassword(password, stored) {
  const [salt, hex] = stored.split(":")
  if (!salt || !hex) return false
  const derived = await scrypt(password, salt, 32)
  const expected = Buffer.from(hex, "hex")
  if (expected.length !== derived.length) return false
  return timingSafeEqual(expected, derived)
}

function publicUser(row) {
  return { id: row.id, email: row.email, name: row.name }
}

export async function handleAuth({ method, url, body }) {
  if (url.pathname === "/health") return { body: { service: "auth", ok: true } }

  if (method === "POST" && url.pathname === "/internal/signup") {
    const name = String(body.name ?? "").trim()
    const email = String(body.email ?? "").trim().toLowerCase()
    const password = String(body.password ?? "")
    if (name.length < 2 || !email.includes("@") || password.length < 8) {
      return { status: 400, body: { error: "Use your name, a real email, and a password of at least 8 characters." } }
    }
    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email)
    if (existing) return { status: 409, body: { error: "That email already has an account. Log in instead." } }
    const id = crypto.randomUUID()
    db.prepare("INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)").run(
      id,
      email,
      name,
      await hashPassword(password),
      Date.now()
    )
    return { body: { user: { id, email, name } } }
  }

  if (method === "POST" && url.pathname === "/internal/login") {
    const email = String(body.email ?? "").trim().toLowerCase()
    const row = db.prepare("SELECT id, email, name, password_hash FROM users WHERE email = ?").get(email)
    if (!row || !(await verifyPassword(String(body.password ?? ""), row.password_hash))) {
      return { status: 401, body: { error: "Email or password does not match." } }
    }
    return { body: { user: publicUser(row) } }
  }

  if (method === "POST" && url.pathname === "/internal/session/start") {
    const token = randomBytes(32).toString("hex")
    db.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)").run(
      hashToken(token),
      body.userId,
      Date.now() + MAX_AGE * 1000
    )
    return { body: { token, maxAge: MAX_AGE } }
  }

  if (method === "POST" && url.pathname === "/internal/session/end") {
    if (body.token) db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(body.token))
    return { body: { ok: true } }
  }

  if (method === "POST" && url.pathname === "/internal/session/read") {
    if (!body.token) return { status: 401, body: { user: null } }
    const row = db
      .prepare(
        `SELECT users.id, users.email, users.name FROM sessions
         JOIN users ON users.id = sessions.user_id
         WHERE sessions.token_hash = ? AND sessions.expires_at > ?`
      )
      .get(hashToken(body.token), Date.now())
    if (!row) return { status: 401, body: { user: null } }
    return { body: { user: publicUser(row) } }
  }

  if (method === "POST" && url.pathname === "/internal/users") {
    const ids = Array.isArray(body.ids) ? body.ids : []
    if (ids.length === 0) return { body: { users: [] } }
    const marks = ids.map(() => "?").join(",")
    const users = db.prepare(`SELECT id, email, name FROM users WHERE id IN (${marks})`).all(...ids)
    return { body: { users } }
  }

  return { status: 404, body: { error: "Not found" } }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  listen("auth", ports.auth, handleAuth)
}
