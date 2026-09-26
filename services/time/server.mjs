import path from "node:path"
import { fileURLToPath } from "node:url"
import { listen } from "../lib/http.mjs"
import { openDb } from "../lib/sqlite.mjs"
import { ports } from "../lib/defaults.mjs"

const db = openDb("time.db", `CREATE TABLE IF NOT EXISTS logs (team_id TEXT PRIMARY KEY, entries TEXT NOT NULL);`)

export async function handleTime({ method, url, body }) {
  if (url.pathname === "/health") return { body: { service: "time", ok: true } }
  if (method === "POST" && url.pathname === "/internal/read") {
    const row = db.prepare("SELECT entries FROM logs WHERE team_id = ?").get(body.teamId)
    return { body: { entries: row ? JSON.parse(row.entries) : [] } }
  }
  if (method === "POST" && url.pathname === "/internal/write") {
    db.prepare(
      `INSERT INTO logs (team_id, entries) VALUES (?, ?)
       ON CONFLICT(team_id) DO UPDATE SET entries = excluded.entries`
    ).run(body.teamId, JSON.stringify(body.entries ?? []))
    return { body: { ok: true } }
  }
  return { status: 404, body: { error: "Not found" } }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  listen("time", ports.time, handleTime)
}
