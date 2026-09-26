import { existsSync } from "node:fs"
import path from "node:path"
import { DatabaseSync } from "node:sqlite"
import { defaultPomodoro } from "./lib/defaults.mjs"
import { openDb } from "./lib/sqlite.mjs"

const legacyPath = path.join(process.cwd(), "data", "harbor.db")
const marker = path.join(process.cwd(), "data", ".migrated-services")
if (!existsSync(legacyPath) || existsSync(marker)) {
  process.exit(0)
}

const legacy = new DatabaseSync(legacyPath)
const tables = new Set(legacy.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name))
if (!tables.has("users") || !tables.has("teams")) process.exit(0)

const auth = openDb(
  "auth.db",
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, password_hash TEXT NOT NULL, created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL
  );`
)
const teams = openDb(
  "teams.db",
  `CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS memberships (
    team_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT NOT NULL, PRIMARY KEY (team_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS invites (
    code TEXT PRIMARY KEY, team_id TEXT NOT NULL, created_by TEXT NOT NULL, created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS active_teams (user_id TEXT PRIMARY KEY, team_id TEXT NOT NULL);`
)
const issues = openDb("issues.db", `CREATE TABLE IF NOT EXISTS boards (team_id TEXT PRIMARY KEY, issues TEXT NOT NULL, next_number INTEGER NOT NULL);`)
const time = openDb("time.db", `CREATE TABLE IF NOT EXISTS logs (team_id TEXT PRIMARY KEY, entries TEXT NOT NULL);`)
const notes = openDb("notes.db", `CREATE TABLE IF NOT EXISTS books (team_id TEXT PRIMARY KEY, notes TEXT NOT NULL);`)
const pomodoro = openDb(
  "pomodoro.db",
  `CREATE TABLE IF NOT EXISTS timers (team_id TEXT NOT NULL, user_id TEXT NOT NULL, state TEXT NOT NULL, PRIMARY KEY (team_id, user_id));`
)

for (const user of legacy.prepare("SELECT id, email, name, password_hash, created_at FROM users").all()) {
  auth.prepare("INSERT OR IGNORE INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)").run(
    user.id,
    user.email,
    user.name,
    user.password_hash,
    user.created_at
  )
}
if (tables.has("sessions")) {
  for (const session of legacy.prepare("SELECT token_hash, user_id, expires_at FROM sessions").all()) {
    auth.prepare("INSERT OR IGNORE INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)").run(session.token_hash, session.user_id, session.expires_at)
  }
}
for (const team of legacy.prepare("SELECT id, name, revision, workspace, created_at FROM teams").all()) {
  teams.prepare("INSERT OR IGNORE INTO teams (id, name, revision, created_at) VALUES (?, ?, ?, ?)").run(team.id, team.name, team.revision, team.created_at)
  const workspace = JSON.parse(team.workspace)
  issues.prepare("INSERT OR REPLACE INTO boards (team_id, issues, next_number) VALUES (?, ?, ?)").run(
    team.id,
    JSON.stringify(workspace.issues ?? []),
    workspace.nextNumber || 1
  )
  time.prepare("INSERT OR REPLACE INTO logs (team_id, entries) VALUES (?, ?)").run(team.id, JSON.stringify(workspace.entries ?? []))
  notes.prepare("INSERT OR REPLACE INTO books (team_id, notes) VALUES (?, ?)").run(team.id, JSON.stringify(workspace.notes ?? []))
}
for (const membership of legacy.prepare("SELECT team_id, user_id, role, pomodoro FROM memberships").all()) {
  teams.prepare("INSERT OR IGNORE INTO memberships (team_id, user_id, role) VALUES (?, ?, ?)").run(membership.team_id, membership.user_id, membership.role)
  pomodoro.prepare("INSERT OR REPLACE INTO timers (team_id, user_id, state) VALUES (?, ?, ?)").run(
    membership.team_id,
    membership.user_id,
    membership.pomodoro || JSON.stringify(defaultPomodoro())
  )
}
if (tables.has("invites")) {
  for (const invite of legacy.prepare("SELECT code, team_id, created_by, created_at FROM invites").all()) {
    teams.prepare("INSERT OR IGNORE INTO invites (code, team_id, created_by, created_at) VALUES (?, ?, ?, ?)").run(
      invite.code,
      invite.team_id,
      invite.created_by,
      invite.created_at
    )
  }
}
if (tables.has("active_teams")) {
  for (const active of legacy.prepare("SELECT user_id, team_id FROM active_teams").all()) {
    teams.prepare("INSERT OR IGNORE INTO active_teams (user_id, team_id) VALUES (?, ?)").run(active.user_id, active.team_id)
  }
}

const { writeFileSync } = await import("node:fs")
writeFileSync(marker, new Date().toISOString())
console.log("Split the existing Harbor database across services.")
