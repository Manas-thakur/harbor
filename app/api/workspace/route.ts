import { NextResponse } from "next/server"
import { activeTeamId, listMembers, listTeams, readWorkspace, writeWorkspace } from "@/lib/db"
import { readUser } from "@/lib/session"
import type { StoreData } from "@/lib/types"

export const runtime = "nodejs"

export async function GET() {
  const user = await readUser()
  if (!user) return NextResponse.json({ error: "Log in first." }, { status: 401 })
  const teams = listTeams(user.id)
  const teamId = activeTeamId(user.id)
  if (!teamId) return NextResponse.json({ error: "No team." }, { status: 404 })
  const workspace = readWorkspace(user.id, teamId)
  if (!workspace) return NextResponse.json({ error: "No team." }, { status: 404 })
  return NextResponse.json({
    teams,
    teamId,
    teamName: workspace.teamName,
    members: listMembers(teamId),
    revision: workspace.revision,
    data: workspace.data,
  })
}

export async function PUT(request: Request) {
  const user = await readUser()
  if (!user) return NextResponse.json({ error: "Log in first." }, { status: 401 })
  const teamId = activeTeamId(user.id)
  if (!teamId) return NextResponse.json({ error: "No team." }, { status: 404 })
  const body = (await request.json()) as { revision?: number; data?: StoreData }
  if (!body.data || typeof body.revision !== "number") {
    return NextResponse.json({ error: "Missing workspace." }, { status: 400 })
  }
  const result = writeWorkspace(user.id, teamId, body.revision, body.data)
  if (!result.ok) {
    const fresh = readWorkspace(user.id, teamId)
    return NextResponse.json({ error: "Someone else saved first.", revision: fresh?.revision, data: fresh?.data }, { status: result.status })
  }
  return NextResponse.json({ ok: true, revision: result.revision })
}
