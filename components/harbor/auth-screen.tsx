"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useStore } from "@/lib/store"

export function AuthScreen() {
  const { login, signup } = useStore()
  const [mode, setMode] = useState<"login" | "signup">("signup")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    const message = mode === "signup" ? await signup(name, email, password) : await login(email, password)
    setPending(false)
    if (message) setError(message)
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-6">
        <p className="text-lg font-medium tracking-tight">Harbor</p>
        <p className="mt-1 text-sm text-muted-foreground">
          A shared place for a team’s issues, notes, causes, and hours. Each person has their own login.
        </p>
        <form className="mt-6 grid gap-3" onSubmit={submit}>
          {mode === "signup" ? (
            <label className="grid gap-1 text-xs text-muted-foreground">
              Name
              <Input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required />
            </label>
          ) : null}
          <label className="grid gap-1 text-xs text-muted-foreground">
            Email
            <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Password
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              minLength={8}
              required
            />
          </label>
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          <Button type="submit" disabled={pending}>
            {pending ? "Working…" : mode === "signup" ? "Create account" : "Log in"}
          </Button>
        </form>
        <button
          className="mt-4 text-sm text-muted-foreground hover:text-foreground"
          onClick={() => {
            setMode(mode === "signup" ? "login" : "signup")
            setError(null)
          }}
        >
          {mode === "signup" ? "I already have an account" : "Create an account"}
        </button>
      </div>
    </div>
  )
}
