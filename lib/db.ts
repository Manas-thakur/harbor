import { mkdirSync } from "node:fs"
import { DatabaseSync } from "node:sqlite"
import path from "node:path"
import { defaultPomodoro, type PomodoroState, type StoreData } from "@/lib/types"

export type UserRow = { id: string; email: string; name: string; password_hash: string; created_at: number }
export type TeamSummary = { id: string; name: string; role: "owner" | "member" }
export type Member = { id: string; name: string; email: string; role: "owner" | "member" }

const dbPath = path.join(process.cwd(), "data", "harbor.db")
mkdirSync(path.dirname(dbPath), { recursive: true })

const db = new DatabaseSync(dbPath)
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS users (
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
  );
  CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 0,
    workspace TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS memberships (
    team_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL,
    pomodoro TEXT NOT NULL,
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
  );
`)

export function getDb() {
  return db
}

export function emptyWorkspace(): StoreData {
  return { issues: [], entries: [], notes: [], pomodoro: defaultPomodoro(), nextNumber: 1 }
}

export function sharedFrom(data: StoreData) {
  return {
    issues: data.issues,
    entries: data.entries,
    notes: data.notes,
    nextNumber: data.nextNumber,
  }
}

export function createUser(input: { id: string; email: string; name: string; passwordHash: string }) {
  db.prepare("INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)").run(
    input.id,
    input.email,
    input.name,
    input.passwordHash,
    Date.now()
  )
}

export function findUserByEmail(email: string) {
  return db.prepare("SELECT id, email, name, password_hash, created_at FROM users WHERE email = ?").get(email) as UserRow | undefined
}

export function findUserById(id: string) {
  return db.prepare("SELECT id, email, name, password_hash, created_at FROM users WHERE id = ?").get(id) as UserRow | undefined
}

export function createSession(tokenHash: string, userId: string, expiresAt: number) {
  db.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)").run(tokenHash, userId, expiresAt)
}

export function deleteSession(tokenHash: string) {
  db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash)
}

export function userForSession(tokenHash: string) {
  const row = db
    .prepare(
      `SELECT users.id, users.email, users.name, users.password_hash, users.created_at
       FROM sessions JOIN users ON users.id = sessions.user_id
       WHERE sessions.token_hash = ? AND sessions.expires_at > ?`
    )
    .get(tokenHash, Date.now()) as UserRow | undefined
  return row
}

export function createTeam(input: { id: string; name: string; userId: string; workspace: StoreData }) {
  const shared = sharedFrom(input.workspace)
  const tx = db.prepare("BEGIN")
  tx.run()
  try {
    db.prepare("INSERT INTO teams (id, name, revision, workspace, created_at) VALUES (?, ?, 0, ?, ?)").run(
      input.id,
      input.name,
      JSON.stringify(shared),
      Date.now()
    )
    db.prepare("INSERT INTO memberships (team_id, user_id, role, pomodoro) VALUES (?, ?, 'owner', ?)").run(
      input.id,
      input.userId,
      JSON.stringify(input.workspace.pomodoro)
    )
    db.prepare("INSERT INTO active_teams (user_id, team_id) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET team_id = excluded.team_id").run(
      input.userId,
      input.id
    )
    db.prepare("COMMIT").run()
  } catch (error) {
    db.prepare("ROLLBACK").run()
    throw error
  }
}

export function listTeams(userId: string): TeamSummary[] {
  return db
    .prepare(
      `SELECT teams.id, teams.name, memberships.role
       FROM memberships JOIN teams ON teams.id = memberships.team_id
       WHERE memberships.user_id = ?
       ORDER BY teams.created_at ASC`
    )
    .all(userId) as TeamSummary[]
}

export function activeTeamId(userId: string) {
  const row = db.prepare("SELECT team_id FROM active_teams WHERE user_id = ?").get(userId) as { team_id: string } | undefined
  return row?.team_id ?? null
}

export function setActiveTeam(userId: string, teamId: string) {
  const member = membership(userId, teamId)
  if (!member) return false
  db.prepare("INSERT INTO active_teams (user_id, team_id) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET team_id = excluded.team_id").run(
    userId,
    teamId
  )
  return true
}

export function membership(userId: string, teamId: string) {
  return db.prepare("SELECT role, pomodoro FROM memberships WHERE user_id = ? AND team_id = ?").get(userId, teamId) as
    | { role: "owner" | "member"; pomodoro: string }
    | undefined
}

export function readWorkspace(userId: string, teamId: string) {
  const member = membership(userId, teamId)
  if (!member) return null
  const team = db.prepare("SELECT id, name, revision, workspace FROM teams WHERE id = ?").get(teamId) as
    | { id: string; name: string; revision: number; workspace: string }
    | undefined
  if (!team) return null
  const shared = JSON.parse(team.workspace) as Omit<StoreData, "pomodoro">
  const pomodoro = JSON.parse(member.pomodoro) as PomodoroState
  const data: StoreData = { ...shared, pomodoro }
  return { data, revision: team.revision, teamName: team.name }
}

export function writeWorkspace(userId: string, teamId: string, revision: number, data: StoreData) {
  const member = membership(userId, teamId)
  if (!member) return { ok: false as const, status: 403 }
  const current = db.prepare("SELECT revision FROM teams WHERE id = ?").get(teamId) as { revision: number } | undefined
  if (!current) return { ok: false as const, status: 404 }
  if (current.revision !== revision) return { ok: false as const, status: 409, revision: current.revision }
  const next = current.revision + 1
  db.prepare("UPDATE teams SET workspace = ?, revision = ? WHERE id = ? AND revision = ?").run(
    JSON.stringify(sharedFrom(data)),
    next,
    teamId,
    revision
  )
  db.prepare("UPDATE memberships SET pomodoro = ? WHERE team_id = ? AND user_id = ?").run(JSON.stringify(data.pomodoro), teamId, userId)
  return { ok: true as const, revision: next }
}

export function createInvite(teamId: string, userId: string) {
  if (!membership(userId, teamId)) return null
  const code = Math.random().toString(36).slice(2, 8).toUpperCase()
  db.prepare("INSERT INTO invites (code, team_id, created_by, created_at) VALUES (?, ?, ?, ?)").run(code, teamId, userId, Date.now())
  return code
}

export function joinTeam(userId: string, code: string) {
  const invite = db.prepare("SELECT team_id FROM invites WHERE code = ?").get(code.trim().toUpperCase()) as { team_id: string } | undefined
  if (!invite) return null
  const existing = membership(userId, invite.team_id)
  if (!existing) {
    db.prepare("INSERT INTO memberships (team_id, user_id, role, pomodoro) VALUES (?, ?, 'member', ?)").run(
      invite.team_id,
      userId,
      JSON.stringify(defaultPomodoro())
    )
  }
  setActiveTeam(userId, invite.team_id)
  return invite.team_id
}

export function listMembers(teamId: string): Member[] {
  return db
    .prepare(
      `SELECT users.id, users.name, users.email, memberships.role
       FROM memberships JOIN users ON users.id = memberships.user_id
       WHERE memberships.team_id = ?
       ORDER BY memberships.role DESC, users.name ASC`
    )
    .all(teamId) as Member[]
}

export function removeMember(actorId: string, teamId: string, memberId: string) {
  const actor = membership(actorId, teamId)
  if (!actor || actor.role !== "owner" || actorId === memberId) return false
  db.prepare("DELETE FROM memberships WHERE team_id = ? AND user_id = ?").run(teamId, memberId)
  db.prepare("DELETE FROM active_teams WHERE user_id = ? AND team_id = ?").run(memberId, teamId)
  return true
}
