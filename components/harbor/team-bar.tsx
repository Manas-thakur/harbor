"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useStore } from "@/lib/store"

export function TeamBar() {
  const store = useStore()
  const [teamName, setTeamName] = useState("")
  const [code, setCode] = useState("")
  const [openMembers, setOpenMembers] = useState(false)
  const role = store.teams.find((team) => team.id === store.teamId)?.role

  return (
    <div className="mx-3 mt-4 rounded-xl border border-sidebar-border p-3">
      <p className="text-[11px] tracking-wide text-muted-foreground uppercase">Team</p>
      <p className="mt-1 truncate text-sm font-medium">{store.teamName}</p>
      <p className="truncate text-xs text-muted-foreground">{store.user?.name}</p>
      {store.teams.length > 1 ? (
        <select
          className="mt-2 h-8 w-full rounded-lg border border-input bg-transparent px-2 text-xs"
          value={store.teamId ?? ""}
          onChange={(event) => void store.switchTeam(event.target.value)}
        >
          {store.teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-1">
        <Button
          size="xs"
          variant="secondary"
          onClick={async () => {
            const invite = await store.inviteToTeam()
            if (!invite) {
              toast.error("Could not create an invite.")
              return
            }
            await navigator.clipboard.writeText(invite)
            toast(`Invite code ${invite} copied`)
          }}
        >
          Invite
        </Button>
        <Button size="xs" variant="ghost" onClick={() => setOpenMembers((value) => !value)}>
          People
        </Button>
        <Button size="xs" variant="ghost" onClick={() => void store.logout()}>
          Log out
        </Button>
      </div>
      {openMembers ? (
        <ul className="mt-2 space-y-1">
          {store.members.map((member) => (
            <li key={member.id} className="flex items-center justify-between gap-2 text-xs">
              <span className="min-w-0">
                <span className="block truncate">{member.name}</span>
                <span className="text-muted-foreground">{member.role}</span>
              </span>
              {role === "owner" && member.id !== store.user?.id ? (
                <button className="text-rose-300" onClick={() => void store.removeMember(member.id)}>
                  Remove
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      <form
        className="mt-3 grid gap-1"
        onSubmit={async (event) => {
          event.preventDefault()
          const error = await store.createTeam(teamName)
          if (error) toast.error(error)
          else {
            setTeamName("")
            toast("Team created")
          }
        }}
      >
        <Input value={teamName} onChange={(event) => setTeamName(event.target.value)} placeholder="New team name" className="h-8 text-xs" />
      </form>
      <form
        className="mt-1 grid gap-1"
        onSubmit={async (event) => {
          event.preventDefault()
          const error = await store.joinTeam(code)
          if (error) toast.error(error)
          else {
            setCode("")
            toast("Joined the team")
          }
        }}
      >
        <Input value={code} onChange={(event) => setCode(event.target.value)} placeholder="Invite code" className="h-8 text-xs" />
      </form>
    </div>
  )
}
