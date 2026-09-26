import { listen } from "../lib/http.mjs"
import { openDb } from "../lib/sqlite.mjs"
import { ports } from "../lib/defaults.mjs"

const db = openDb(
  "issues.db",
  `CREATE TABLE IF NOT EXISTS boards (
    team_id TEXT PRIMARY KEY,
    issues TEXT NOT NULL,
    next_number INTEGER NOT NULL
  );`
)

listen("issues", ports.issues, async ({ method, url, body }) => {
  if (url.pathname === "/health") return { body: { service: "issues", ok: true } }
  if (method === "POST" && url.pathname === "/internal/read") {
    const row = db.prepare("SELECT issues, next_number FROM boards WHERE team_id = ?").get(body.teamId)
    if (!row) return { body: { issues: [], nextNumber: 1 } }
    return { body: { issues: JSON.parse(row.issues), nextNumber: row.next_number } }
  }
  if (method === "POST" && url.pathname === "/internal/write") {
    db.prepare(
      `INSERT INTO boards (team_id, issues, next_number) VALUES (?, ?, ?)
       ON CONFLICT(team_id) DO UPDATE SET issues = excluded.issues, next_number = excluded.next_number`
    ).run(body.teamId, JSON.stringify(body.issues ?? []), body.nextNumber || 1)
    return { body: { ok: true } }
  }
  return { status: 404, body: { error: "Not found" } }
})
