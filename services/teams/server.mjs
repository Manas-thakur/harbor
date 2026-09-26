import path from "node:path"
import { fileURLToPath } from "node:url"
import { listen } from "../lib/http.mjs"
import { openDb } from "../lib/sqlite.mjs"
import { ports } from "../lib/defaults.mjs"

const db = openDb(
  "teams.db",
  `CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS memberships (
    team_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL,
    PRIMARY KEY (team_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS invites (
    code TEXT PRIMARY KEY,
    team_id TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS active_teams (
    user_id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL
  );`
)

function teamsFor(userId) {
  return db
    .prepare(
      `SELECT teams.id, teams.name, memberships.role
       FROM memberships JOIN teams ON teams.id = memberships.team_id
       WHERE memberships.user_id = ? ORDER BY teams.created_at ASC`
    )
    .all(userId)
}

function member(userId, teamId) {
  return db.prepare("SELECT role FROM memberships WHERE user_id = ? AND team_id = ?").get(userId, teamId)
}

function activeId(userId) {
  return db.prepare("SELECT team_id FROM active_teams WHERE user_id = ?").get(userId)?.team_id ?? null
}

function activate(userId, teamId) {
  db.prepare(
    "INSERT INTO active_teams (user_id, team_id) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET team_id = excluded.team_id"
  ).run(userId, teamId)
}

export async function handleTeams({ method, url, body }) {
  if (url.pathname === "/health") return { body: { service: "teams", ok: true } }

  if (method === "POST" && url.pathname === "/internal/context") {
    const teams = teamsFor(body.userId)
    let teamId = activeId(body.userId)
    if (!teamId || !teams.some((team) => team.id === teamId)) teamId = teams[0]?.id ?? null
    const team = teamId ? db.prepare("SELECT id, name, revision FROM teams WHERE id = ?").get(teamId) : null
    const members = teamId
      ? db.prepare("SELECT user_id, role FROM memberships WHERE team_id = ? ORDER BY role DESC").all(teamId)
      : []
    return { body: { teams, teamId, teamName: team?.name ?? null, revision: team?.revision ?? 0, members } }
  }

  if (method === "POST" && url.pathname === "/internal/create") {
    const name = String(body.name ?? "").trim()
    if (name.length < 2) return { status: 400, body: { error: "Give the team a name." } }
    const id = crypto.randomUUID()
    db.prepare("INSERT INTO teams (id, name, revision, created_at) VALUES (?, ?, 0, ?)").run(id, name, Date.now())
    db.prepare("INSERT INTO memberships (team_id, user_id, role) VALUES (?, ?, 'owner')").run(id, body.userId)
    activate(body.userId, id)
    return { body: { ok: true, teamId: id } }
  }

  if (method === "POST" && url.pathname === "/internal/join") {
    const invite = db.prepare("SELECT team_id FROM invites WHERE code = ?").get(String(body.code ?? "").trim().toUpperCase())
    if (!invite) return { status: 404, body: { error: "That invite code does not match a team." } }
    if (!member(body.userId, invite.team_id)) {
      db.prepare("INSERT INTO memberships (team_id, user_id, role) VALUES (?, ?, 'member')").run(invite.team_id, body.userId)
    }
    activate(body.userId, invite.team_id)
    return { body: { ok: true, teamId: invite.team_id } }
  }

  if (method === "POST" && url.pathname === "/internal/switch") {
    if (!body.teamId || !member(body.userId, body.teamId)) return { status: 403, body: { error: "You are not on that team." } }
    activate(body.userId, body.teamId)
    return { body: { ok: true } }
  }

  if (method === "POST" && url.pathname === "/internal/invite") {
    const teamId = body.teamId || activeId(body.userId)
    if (!teamId || !member(body.userId, teamId)) return { status: 400, body: { error: "Pick a team first." } }
    const code = Math.random().toString(36).slice(2, 8).toUpperCase()
    db.prepare("INSERT INTO invites (code, team_id, created_by, created_at) VALUES (?, ?, ?, ?)").run(code, teamId, body.userId, Date.now())
    return { body: { ok: true, code } }
  }

  if (method === "POST" && url.pathname === "/internal/remove") {
    const actor = member(body.userId, body.teamId)
    if (!actor || actor.role !== "owner" || body.userId === body.memberId) {
      return { status: 403, body: { error: "Only an owner can remove someone else." } }
    }
    db.prepare("DELETE FROM memberships WHERE team_id = ? AND user_id = ?").run(body.teamId, body.memberId)
    db.prepare("DELETE FROM active_teams WHERE user_id = ? AND team_id = ?").run(body.memberId, body.teamId)
    return { body: { ok: true } }
  }

  if (method === "POST" && url.pathname === "/internal/bump") {
    if (!member(body.userId, body.teamId)) return { status: 403, body: { error: "You are not on that team." } }
    const current = db.prepare("SELECT revision FROM teams WHERE id = ?").get(body.teamId)
    if (!current) return { status: 404, body: { error: "No team." } }
    if (current.revision !== body.revision) return { status: 409, body: { revision: current.revision } }
    db.prepare("UPDATE teams SET revision = ? WHERE id = ? AND revision = ?").run(current.revision + 1, body.teamId, body.revision)
    return { body: { revision: current.revision + 1 } }
  }

  return { status: 404, body: { error: "Not found" } }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  listen("teams", ports.teams, handleTeams)
}
