import path from "node:path"
import { fileURLToPath } from "node:url"
import { listen } from "../lib/http.mjs"
import { openDb } from "../lib/sqlite.mjs"
import { ports } from "../lib/defaults.mjs"

const db = openDb("notes.db", `CREATE TABLE IF NOT EXISTS books (team_id TEXT PRIMARY KEY, notes TEXT NOT NULL);`)

export async function handleNotes({ method, url, body }) {
  if (url.pathname === "/health") return { body: { service: "notes", ok: true } }
  if (method === "POST" && url.pathname === "/internal/read") {
    const row = db.prepare("SELECT notes FROM books WHERE team_id = ?").get(body.teamId)
    return { body: { notes: row ? JSON.parse(row.notes) : [] } }
  }
  if (method === "POST" && url.pathname === "/internal/write") {
    db.prepare(
      `INSERT INTO books (team_id, notes) VALUES (?, ?)
       ON CONFLICT(team_id) DO UPDATE SET notes = excluded.notes`
    ).run(body.teamId, JSON.stringify(body.notes ?? []))
    return { body: { ok: true } }
  }
  return { status: 404, body: { error: "Not found" } }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  listen("notes", ports.notes, handleNotes)
}
