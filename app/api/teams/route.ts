import { NextResponse } from "next/server"
import { activeTeamId, createInvite, createTeam, emptyWorkspace, joinTeam, listMembers, listTeams, removeMember, setActiveTeam } from "@/lib/db"
import { readUser } from "@/lib/session"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const user = await readUser()
  if (!user) return NextResponse.json({ error: "Log in first." }, { status: 401 })
  const body = (await request.json()) as { action?: string; name?: string; code?: string; teamId?: string; memberId?: string }

  if (body.action === "create") {
    const name = body.name?.trim() ?? ""
    if (name.length < 2) return NextResponse.json({ error: "Give the team a name." }, { status: 400 })
    const id = crypto.randomUUID()
    createTeam({ id, name, userId: user.id, workspace: emptyWorkspace() })
    return NextResponse.json({ ok: true, teamId: id })
  }

  if (body.action === "join") {
    const teamId = joinTeam(user.id, body.code ?? "")
    if (!teamId) return NextResponse.json({ error: "That invite code does not match a team." }, { status: 404 })
    return NextResponse.json({ ok: true, teamId })
  }

  if (body.action === "switch") {
    if (!body.teamId || !setActiveTeam(user.id, body.teamId)) {
      return NextResponse.json({ error: "You are not on that team." }, { status: 403 })
    }
    return NextResponse.json({ ok: true })
  }

  if (body.action === "invite") {
    const teamId = body.teamId || activeTeamId(user.id)
    const active = teamId && listTeams(user.id).some((team) => team.id === teamId) ? teamId : null
    if (!active) return NextResponse.json({ error: "Pick a team first." }, { status: 400 })
    const code = createInvite(active, user.id)
    return NextResponse.json({ ok: true, code })
  }

  if (body.action === "remove") {
    if (!body.teamId || !body.memberId || !removeMember(user.id, body.teamId, body.memberId)) {
      return NextResponse.json({ error: "Only an owner can remove someone else." }, { status: 403 })
    }
    return NextResponse.json({ ok: true, members: listMembers(body.teamId) })
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 })
}
