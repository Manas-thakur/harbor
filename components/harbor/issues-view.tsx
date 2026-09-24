"use client"

import { Play, Square } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyHint, PriorityMark, StatusIcon, TypeIcon, priorityLabel, statusLabel, typeLabel } from "@/components/harbor/ui-bits"
import { formatDuration } from "@/lib/format"
import { useStore } from "@/lib/store"
import { issueKey, loggedMs, PRIORITY_RANK, type Issue, type IssueStatus, type Priority, type TimeEntry } from "@/lib/types"

export type QuickFilter = "open" | "bugs" | "progress" | "uncaused" | "done" | "all"
export type SortKey = "updated" | "priority" | "time" | "created"

export function filterIssues(issues: Issue[], quick: QuickFilter, query: string) {
  const needle = query.trim().toLowerCase()
  return issues.filter((issue) => {
    if (quick === "open" && issue.status === "done") return false
    if (quick === "bugs" && issue.type !== "bug") return false
    if (quick === "progress" && issue.status !== "in_progress") return false
    if (quick === "uncaused" && (issue.type !== "bug" || issue.cause.trim())) return false
    if (quick === "done" && issue.status !== "done") return false
    if (!needle) return true
    const haystack = `${issueKey(issue.number)} ${issue.title} ${issue.cause} ${issue.description}`.toLowerCase()
    return haystack.includes(needle)
  })
}

export function sortIssues(issues: Issue[], sort: SortKey, entries: TimeEntry[], now: number) {
  const copy = [...issues]
  copy.sort((a, b) => {
    if (sort === "priority") return PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority] || b.updatedAt - a.updatedAt
    if (sort === "time") return loggedMs(entries, b.id, now) - loggedMs(entries, a.id, now)
    if (sort === "created") return b.createdAt - a.createdAt
    return b.updatedAt - a.updatedAt
  })
  return copy
}

export function IssueList({
  issues,
  selectedId,
  now,
  onSelect,
}: {
  issues: Issue[]
  selectedId: string | null
  now: number
  onSelect: (id: string) => void
}) {
  const { data, startTimer, stopTimer, updateIssue } = useStore()
  const runningId = data.entries.find((entry) => entry.endedAt === null)?.issueId

  if (issues.length === 0) {
    return (
      <EmptyHint
        title="Nothing matches"
        body="Change the filter, or create an issue. A bug is worth writing down even if you only know the symptom."
      />
    )
  }

  return (
    <ul className="harbor-scroll min-h-0 flex-1 overflow-y-auto">
      {issues.map((issue) => {
        const selected = issue.id === selectedId
        const running = runningId === issue.id
        const time = loggedMs(data.entries, issue.id, now)
        return (
          <li key={issue.id}>
            <div
              className={`group flex w-full items-center gap-2 border-b px-3 py-2.5 text-left transition-colors ${
                selected ? "bg-accent" : "hover:bg-muted/60"
              }`}
            >
              <button
                className="shrink-0 rounded-md p-1 hover:bg-background/60"
                aria-label={`Status: ${statusLabel(issue.status)}. Click to advance.`}
                onClick={() => updateIssue(issue.id, { status: nextStatus(issue.status) })}
              >
                <StatusIcon status={issue.status} />
              </button>
              <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => onSelect(issue.id)}>
                <span className="w-14 shrink-0 font-mono text-xs text-muted-foreground">{issueKey(issue.number)}</span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-sm ${issue.status === "done" ? "text-muted-foreground line-through" : ""}`}>
                    {issue.title}
                  </span>
                  <span className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <TypeIcon type={issue.type} />
                    {typeLabel(issue.type)}
                    {issue.type === "bug" ? (
                      <span className={issue.cause.trim() ? "truncate" : "text-amber-200/90"}>
                        {issue.cause.trim() || "No cause yet"}
                      </span>
                    ) : null}
                  </span>
                </span>
                <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
                  <PriorityMark priority={issue.priority} />
                  {priorityLabel(issue.priority)}
                </span>
                <span className="w-14 shrink-0 text-right font-mono text-xs text-muted-foreground">
                  {time > 0 || running ? formatDuration(time) : ""}
                </span>
              </button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={running ? "Stop timer" : "Start timer"}
                onClick={() => (running ? stopTimer() : startTimer(issue.id))}
              >
                {running ? <Square className="text-amber-200" /> : <Play />}
              </Button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function nextStatus(status: IssueStatus): IssueStatus {
  if (status === "backlog") return "todo"
  if (status === "todo") return "in_progress"
  if (status === "in_progress") return "done"
  return "backlog"
}

export const QUICK_FILTERS: { id: QuickFilter; label: string }[] = [
  { id: "open", label: "Open" },
  { id: "bugs", label: "Bugs" },
  { id: "progress", label: "In progress" },
  { id: "uncaused", label: "No cause" },
  { id: "done", label: "Done" },
  { id: "all", label: "All" },
]

export const SORTS: { id: SortKey; label: string }[] = [
  { id: "updated", label: "Recently updated" },
  { id: "priority", label: "Priority" },
  { id: "time", label: "Time logged" },
  { id: "created", label: "Newest" },
]

export type { Priority }
