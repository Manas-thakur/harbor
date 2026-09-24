"use client"

import { useMemo, useState } from "react"
import { Square, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { dayKey, dayLabel, formatClock, formatDuration, formatTime, startOfDay } from "@/lib/format"
import { useStore } from "@/lib/store"
import { entryDuration, issueKey, type TimeEntry } from "@/lib/types"

export function TimeView({ now, onOpenIssue }: { now: number; onOpenIssue: (id: string) => void }) {
  const { data, stopTimer, deleteEntry, addEntry } = useStore()
  const [open, setOpen] = useState(false)
  const running = data.entries.find((entry) => entry.endedAt === null)

  const days = useMemo(() => lastDays(7), [])
  const totals = days.map((day) =>
    data.entries.reduce((sum, entry) => sum + overlap(entry, day, day + 86_400_000, now), 0)
  )
  const max = Math.max(...totals, 1)
  const todayTotal = totals[6] ?? 0
  const weekTotal = totals.reduce((sum, value) => sum + value, 0)

  const groups = groupEntries(data.entries, now)

  return (
    <div className="harbor-scroll min-h-0 flex-1 overflow-y-auto">
      <div className="grid gap-4 p-4 lg:grid-cols-[280px_1fr]">
        <section className="rounded-xl border bg-card/50 p-4">
          <p className="text-xs tracking-wide text-muted-foreground uppercase">Today</p>
          <p className="mt-1 font-mono text-4xl tracking-tight">{formatDuration(todayTotal)}</p>
          <p className="mt-1 text-sm text-muted-foreground">This week {formatDuration(weekTotal)}</p>
          <div className="mt-5 flex h-28 items-end gap-2">
            {days.map((day, index) => (
              <div key={day} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex h-20 w-full items-end">
                  <div
                    className={`w-full rounded-sm ${index === 6 ? "bg-primary" : "bg-primary/35"}`}
                    style={{ height: `${Math.max(6, (totals[index] / max) * 100)}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(day).toLocaleDateString(undefined, { weekday: "narrow" })}
                </span>
              </div>
            ))}
          </div>
          {running ? (
            <div className="mt-4 rounded-lg border border-amber-300/30 bg-amber-300/10 px-3 py-2">
              <p className="font-mono text-sm text-amber-100">{formatClock(now - running.startedAt)}</p>
              <p className="truncate text-xs text-muted-foreground">{titleFor(data.issues, running.issueId)}</p>
              <Button className="mt-2" size="sm" variant="secondary" onClick={() => stopTimer()}>
                <Square /> Stop
              </Button>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">No timer running. Start one from an issue.</p>
          )}
          <Button className="mt-4 w-full" variant="outline" onClick={() => setOpen(true)} disabled={data.issues.length === 0}>
            Log time
          </Button>
        </section>

        <section className="rounded-xl border">
          {groups.length === 0 ? (
            <p className="px-4 py-10 text-sm text-muted-foreground">Time you log shows up here, grouped by day.</p>
          ) : (
            groups.map((group) => (
              <div key={group.key}>
                <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-2">
                  <h2 className="text-sm font-medium">{group.label}</h2>
                  <span className="font-mono text-xs text-muted-foreground">{formatDuration(group.total)}</span>
                </div>
                <ul>
                  {group.entries.map((entry) => {
                    const issue = data.issues.find((item) => item.id === entry.issueId)
                    return (
                      <li key={entry.id} className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0">
                        <div className="w-28 shrink-0 font-mono text-xs text-muted-foreground">
                          {entry.endedAt === null ? "Now" : `${formatTime(entry.startedAt)} – ${formatTime(entry.endedAt)}`}
                        </div>
                        <button className="min-w-0 flex-1 text-left" onClick={() => issue && onOpenIssue(issue.id)}>
                          <p className="truncate text-sm">
                            <span className="mr-2 font-mono text-xs text-muted-foreground">
                              {issue ? issueKey(issue.number) : "Removed"}
                            </span>
                            {issue?.title ?? "Issue deleted"}
                          </p>
                          {entry.note ? <p className="truncate text-xs text-muted-foreground">{entry.note}</p> : null}
                        </button>
                        <span className="font-mono text-sm">{formatDuration(entryDuration(entry, now))}</span>
                        {entry.endedAt !== null ? (
                          <Button variant="ghost" size="icon-xs" aria-label="Delete entry" onClick={() => deleteEntry(entry.id)}>
                            <Trash2 />
                          </Button>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))
          )}
        </section>
      </div>
      <LogTimeDialog open={open} onOpenChange={setOpen} onSave={(entry) => { addEntry(entry); toast("Time logged"); }} />
    </div>
  )
}

function LogTimeDialog({
  open,
  onOpenChange,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (entry: Omit<TimeEntry, "id">) => void
}) {
  const { data } = useStore()
  const [issueId, setIssueId] = useState(data.issues[0]?.id ?? "")
  const [date, setDate] = useState(() => dayKey(Date.now()))
  const [start, setStart] = useState("09:00")
  const [end, setEnd] = useState("10:00")
  const [note, setNote] = useState("")

  function save() {
    const startedAt = combine(date, start)
    const endedAt = combine(date, end)
    if (!issueId || Number.isNaN(startedAt) || Number.isNaN(endedAt) || endedAt <= startedAt) {
      toast.error("Check the issue and the times. The end has to be after the start.")
      return
    }
    onSave({ issueId, startedAt, endedAt, note: note.trim() })
    setNote("")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log time</DialogTitle>
          <DialogDescription>Add a block you already worked, without starting the timer.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <label className="grid gap-1 text-xs text-muted-foreground">
            Issue
            <select
              className="h-8 rounded-lg border border-input bg-input/30 px-2 text-sm text-foreground"
              value={issueId}
              onChange={(event) => setIssueId(event.target.value)}
            >
              {data.issues.map((issue) => (
                <option key={issue.id} value={issue.id}>
                  {issueKey(issue.number)} {issue.title}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Date
            <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1 text-xs text-muted-foreground">
              Start
              <Input type="time" value={start} onChange={(event) => setStart(event.target.value)} />
            </label>
            <label className="grid gap-1 text-xs text-muted-foreground">
              End
              <Input type="time" value={end} onChange={(event) => setEnd(event.target.value)} />
            </label>
          </div>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Note
            <Input value={note} placeholder="Optional" onChange={(event) => setNote(event.target.value)} />
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function lastDays(count: number) {
  const start = startOfDay(Date.now())
  return Array.from({ length: count }, (_, index) => start - (count - 1 - index) * 86_400_000)
}

function overlap(entry: TimeEntry, from: number, to: number, now: number) {
  const end = entry.endedAt ?? now
  const start = Math.max(entry.startedAt, from)
  const finish = Math.min(end, to)
  return Math.max(0, finish - start)
}

function groupEntries(entries: TimeEntry[], now: number) {
  const map = new Map<string, TimeEntry[]>()
  for (const entry of entries) {
    const key = dayKey(entry.startedAt)
    const list = map.get(key) ?? []
    list.push(entry)
    map.set(key, list)
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([key, list]) => {
      const sorted = list.sort((a, b) => b.startedAt - a.startedAt)
      return {
        key,
        label: dayLabel(sorted[0].startedAt),
        total: sorted.reduce((sum, entry) => sum + entryDuration(entry, now), 0),
        entries: sorted,
      }
    })
}

function titleFor(issues: { id: string; title: string }[], id: string) {
  return issues.find((issue) => issue.id === id)?.title ?? "Issue"
}

function combine(date: string, time: string) {
  const [year, month, day] = date.split("-").map(Number)
  const [hour, minute] = time.split(":").map(Number)
  if (!year || !month || !day || Number.isNaN(hour) || Number.isNaN(minute)) return Number.NaN
  return new Date(year, month - 1, day, hour, minute, 0, 0).getTime()
}
