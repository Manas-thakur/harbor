import { NextResponse } from "next/server"
import { createTeam, createUser, emptyWorkspace, findUserByEmail } from "@/lib/db"
import { hashPassword } from "@/lib/passwords"
import { startSession } from "@/lib/session"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const body = (await request.json()) as { name?: string; email?: string; password?: string }
  const name = body.name?.trim() ?? ""
  const email = body.email?.trim().toLowerCase() ?? ""
  const password = body.password ?? ""
  if (name.length < 2 || !email.includes("@") || password.length < 8) {
    return NextResponse.json({ error: "Use your name, a real email, and a password of at least 8 characters." }, { status: 400 })
  }
  if (findUserByEmail(email)) {
    return NextResponse.json({ error: "That email already has an account. Log in instead." }, { status: 409 })
  }
  const id = crypto.randomUUID()
  createUser({ id, email, name, passwordHash: await hashPassword(password) })
  createTeam({ id: crypto.randomUUID(), name: `${name}'s team`, userId: id, workspace: emptyWorkspace() })
  await startSession(id)
  return NextResponse.json({ ok: true })
}
