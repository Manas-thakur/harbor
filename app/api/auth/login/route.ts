import { NextResponse } from "next/server"
import { findUserByEmail } from "@/lib/db"
import { verifyPassword } from "@/lib/passwords"
import { startSession } from "@/lib/session"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string; password?: string }
  const email = body.email?.trim().toLowerCase() ?? ""
  const password = body.password ?? ""
  const user = findUserByEmail(email)
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return NextResponse.json({ error: "Email or password does not match." }, { status: 401 })
  }
  await startSession(user.id)
  return NextResponse.json({ ok: true })
}
