import { NextResponse } from "next/server"
import { activeTeamId, listMembers, listTeams, readWorkspace } from "@/lib/db"
import { readUser } from "@/lib/session"

export const runtime = "nodejs"

export async function GET() {
  const user = await readUser()
  if (!user) return NextResponse.json({ user: null })
  const teams = listTeams(user.id)
  const teamId = activeTeamId(user.id) ?? teams[0]?.id ?? null
  const workspace = teamId ? readWorkspace(user.id, teamId) : null
  return NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email },
    teams,
    teamId,
    teamName: workspace?.teamName ?? null,
    members: teamId ? listMembers(teamId) : [],
    revision: workspace?.revision ?? 0,
    data: workspace?.data ?? null,
  })
}
