import { listen } from "../lib/http.mjs"
import { openDb } from "../lib/sqlite.mjs"
import { defaultPomodoro, ports } from "../lib/defaults.mjs"

const db = openDb(
  "pomodoro.db",
  `CREATE TABLE IF NOT EXISTS timers (
    team_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    state TEXT NOT NULL,
    PRIMARY KEY (team_id, user_id)
  );`
)

listen("pomodoro", ports.pomodoro, async ({ method, url, body }) => {
  if (url.pathname === "/health") return { body: { service: "pomodoro", ok: true } }
  if (method === "POST" && url.pathname === "/internal/read") {
    const row = db.prepare("SELECT state FROM timers WHERE team_id = ? AND user_id = ?").get(body.teamId, body.userId)
    return { body: { pomodoro: row ? JSON.parse(row.state) : defaultPomodoro() } }
  }
  if (method === "POST" && url.pathname === "/internal/write") {
    db.prepare(
      `INSERT INTO timers (team_id, user_id, state) VALUES (?, ?, ?)
       ON CONFLICT(team_id, user_id) DO UPDATE SET state = excluded.state`
    ).run(body.teamId, body.userId, JSON.stringify(body.pomodoro ?? defaultPomodoro()))
    return { body: { ok: true } }
  }
  return { status: 404, body: { error: "Not found" } }
})
