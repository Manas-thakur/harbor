import http from "node:http"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { call } from "../lib/http.mjs"
import { defaultPomodoro, ports } from "../lib/defaults.mjs"
let localHandlers = null

async function handlers() {
  if (localHandlers) return localHandlers
  const [{ handleAuth }, { handleTeams }, { handleIssues }, { handleTime }, { handleNotes }, { handlePomodoro }] = await Promise.all([
    import("../auth/server.mjs"),
    import("../teams/server.mjs"),
    import("../issues/server.mjs"),
    import("../time/server.mjs"),
    import("../notes/server.mjs"),
    import("../pomodoro/server.mjs"),
  ])
  localHandlers = {
    [ports.auth]: handleAuth,
    [ports.teams]: handleTeams,
    [ports.issues]: handleIssues,
    [ports.time]: handleTime,
    [ports.notes]: handleNotes,
    [ports.pomodoro]: handlePomodoro,
  }
  return localHandlers
}

async function invoke(port, pathname, body) {
  const result = process.env.HARBOR_INPROCESS === "1"
    ? await (await handlers())[port]({ method: "POST", url: new URL(pathname, "http://inprocess"), body: body ?? {}, headers: {} })
    : await call(port, pathname, body)
  return { status: result.status ?? 200, body: result.body ?? {}, headers: result.headers }
}

const COOKIE = "harbor_session"

function readCookie(header) {
  if (!header) return ""
  const parts = header.split(";").map((part) => part.trim())
  const match = parts.find((part) => part.startsWith(`${COOKIE}=`))
  return match ? decodeURIComponent(match.slice(COOKIE.length + 1)) : ""
}

function sessionCookie(token, maxAge) {
  const value = token ? encodeURIComponent(token) : ""
  return `${COOKIE}=${value}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}`
}

async function userFrom(req) {
  const token = readCookie(req.headers.cookie)
  if (!token) return { user: null, token: "" }
  const result = await invoke(ports.auth, "/internal/session/read", { token })
  return { user: result.body.user ?? null, token }
}

async function hydrate(user) {
  const context = await invoke(ports.teams, "/internal/context", { userId: user.id })
  const teamId = context.body.teamId
  if (!teamId) {
    return {
      user,
      teams: context.body.teams ?? [],
      teamId: null,
      teamName: null,
      members: [],
      revision: 0,
      data: null,
    }
  }
  const memberIds = (context.body.members ?? []).map((member) => member.user_id)
  const [people, issues, time, notes, pomodoro] = await Promise.all([
    invoke(ports.auth, "/internal/users", { ids: memberIds }),
    invoke(ports.issues, "/internal/read", { teamId }),
    invoke(ports.time, "/internal/read", { teamId }),
    invoke(ports.notes, "/internal/read", { teamId }),
    invoke(ports.pomodoro, "/internal/read", { teamId, userId: user.id }),
  ])
  const byId = new Map((people.body.users ?? []).map((person) => [person.id, person]))
  return {
    user,
    teams: context.body.teams ?? [],
    teamId,
    teamName: context.body.teamName,
    members: (context.body.members ?? []).map((member) => ({
      id: member.user_id,
      name: byId.get(member.user_id)?.name ?? "Unknown",
      email: byId.get(member.user_id)?.email ?? "",
      role: member.role,
    })),
    revision: context.body.revision ?? 0,
    data: {
      issues: issues.body.issues ?? [],
      entries: time.body.entries ?? [],
      notes: notes.body.notes ?? [],
      pomodoro: pomodoro.body.pomodoro ?? defaultPomodoro(),
      nextNumber: issues.body.nextNumber ?? 1,
    },
  }
}

export async function handle(req, url, body) {
  if (url.pathname === "/health" || url.pathname === "/api/health") {
    const names = ["auth", "teams", "issues", "time", "notes", "pomodoro"]
    const checks = process.env.HARBOR_INPROCESS === "1"
      ? names.map((name) => ({ name, ok: true }))
      : await Promise.all(
          names.map(async (name) => {
            const response = await fetch(`http://127.0.0.1:${ports[name]}/health`)
            return { name, ok: response.ok }
          })
        )
    return { status: checks.every((item) => item.ok) ? 200 : 503, body: { service: "gateway", checks } }
  }

  if (req.method === "POST" && url.pathname === "/api/auth/signup") {
    const created = await invoke(ports.auth, "/internal/signup", body)
    if (created.status !== 200) return created
    await invoke(ports.teams, "/internal/create", { userId: created.body.user.id, name: `${created.body.user.name}'s team` })
    const session = await invoke(ports.auth, "/internal/session/start", { userId: created.body.user.id })
    return { status: 200, body: { ok: true }, headers: { "set-cookie": sessionCookie(session.body.token, session.body.maxAge) } }
  }

  if (req.method === "POST" && url.pathname === "/api/auth/login") {
    const logged = await invoke(ports.auth, "/internal/login", body)
    if (logged.status !== 200) return logged
    const context = await invoke(ports.teams, "/internal/context", { userId: logged.body.user.id })
    if (!context.body.teamId) {
      await invoke(ports.teams, "/internal/create", { userId: logged.body.user.id, name: `${logged.body.user.name}'s team` })
    }
    const session = await invoke(ports.auth, "/internal/session/start", { userId: logged.body.user.id })
    return { status: 200, body: { ok: true }, headers: { "set-cookie": sessionCookie(session.body.token, session.body.maxAge) } }
  }

  if (req.method === "POST" && url.pathname === "/api/auth/logout") {
    const current = await userFrom(req)
    if (current.token) await invoke(ports.auth, "/internal/session/end", { token: current.token })
    return { body: { ok: true }, headers: { "set-cookie": sessionCookie("", 0) } }
  }

  if (req.method === "GET" && url.pathname === "/api/session") {
    const current = await userFrom(req)
    if (!current.user) return { body: { user: null } }
    return { body: await hydrate(current.user) }
  }

  if (req.method === "POST" && url.pathname === "/api/teams") {
    const current = await userFrom(req)
    if (!current.user) return { status: 401, body: { error: "Log in first." } }
    const action = body.action
    const path =
      action === "create"
        ? "/internal/create"
        : action === "join"
          ? "/internal/join"
          : action === "switch"
            ? "/internal/switch"
            : action === "invite"
              ? "/internal/invite"
              : action === "remove"
                ? "/internal/remove"
                : ""
    if (!path) return { status: 400, body: { error: "Unknown action." } }
    const result = await invoke(ports.teams, path, { ...body, userId: current.user.id })
    return { status: result.status, body: result.body }
  }

  if (url.pathname === "/api/workspace" && (req.method === "GET" || req.method === "PUT")) {
    const current = await userFrom(req)
    if (!current.user) return { status: 401, body: { error: "Log in first." } }
    if (req.method === "GET") return { body: await hydrate(current.user) }
    if (!body.data || typeof body.revision !== "number") return { status: 400, body: { error: "Missing workspace." } }
    const context = await invoke(ports.teams, "/internal/context", { userId: current.user.id })
    const teamId = context.body.teamId
    if (!teamId) return { status: 404, body: { error: "No team." } }
    const bumped = await invoke(ports.teams, "/internal/bump", { userId: current.user.id, teamId, revision: body.revision })
    if (bumped.status === 409) {
      const fresh = await hydrate(current.user)
      return { status: 409, body: { error: "Someone else saved first.", revision: fresh.revision, data: fresh.data } }
    }
    if (bumped.status !== 200) return bumped
    await Promise.all([
      invoke(ports.issues, "/internal/write", { teamId, issues: body.data.issues ?? [], nextNumber: body.data.nextNumber || 1 }),
      invoke(ports.time, "/internal/write", { teamId, entries: body.data.entries ?? [] }),
      invoke(ports.notes, "/internal/write", { teamId, notes: body.data.notes ?? [] }),
      invoke(ports.pomodoro, "/internal/write", { teamId, userId: current.user.id, pomodoro: body.data.pomodoro }),
    ])
    return { body: { ok: true, revision: bumped.body.revision } }
  }

  return { status: 404, body: { error: "Not found" } }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMain) {
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://127.0.0.1:${ports.gateway}`)
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const raw = Buffer.concat(chunks).toString("utf8")
    const body = raw ? JSON.parse(raw) : {}
    const result = await handle(req, url, body)
    const headers = { "content-type": "application/json", ...(result.headers ?? {}) }
    res.writeHead(result.status ?? 200, headers)
    res.end(JSON.stringify(result.body ?? {}))
  } catch (error) {
    res.writeHead(500, { "content-type": "application/json" })
    res.end(JSON.stringify({ error: error instanceof Error ? error.message : "Gateway error" }))
  }
})

server.listen(ports.gateway, "127.0.0.1", () => {
  console.log(`gateway listening on ${ports.gateway}`)
})
}
