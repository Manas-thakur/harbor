"use client"

import { useState } from "react"
import { Play, Square, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { FieldSelect, PriorityMark, StatusIcon, TypeIcon, priorityLabel, typeLabel } from "@/components/harbor/ui-bits"
import { formatDuration, formatWhen } from "@/lib/format"
import { useStore } from "@/lib/store"
import { PRIORITIES, STATUSES, TYPES, entryDuration, issueKey, loggedMs, type Issue } from "@/lib/types"

export function IssueDetail({
  issue,
  now,
  onClose,
}: {
  issue: Issue
  now: number
  onClose: () => void
}) {
  const { data, updateIssue, deleteIssue, startTimer, stopTimer, deleteEntry } = useStore()
  const [draft, setDraft] = useState({
    id: issue.id,
    title: issue.title,
    description: issue.description,
    cause: issue.cause,
  })
  if (draft.id !== issue.id) {
    setDraft({
      id: issue.id,
      title: issue.title,
      description: issue.description,
      cause: issue.cause,
    })
  }
  const title = draft.id === issue.id ? draft.title : issue.title
  const description = draft.id === issue.id ? draft.description : issue.description
  const cause = draft.id === issue.id ? draft.cause : issue.cause

  const running = data.entries.find((entry) => entry.endedAt === null && entry.issueId === issue.id)
  const entries = data.entries
    .filter((entry) => entry.issueId === issue.id)
    .sort((a, b) => b.startedAt - a.startedAt)
  const causes = [...new Set(data.issues.map((item) => item.cause.trim()).filter(Boolean))].sort()
  const total = loggedMs(data.entries, issue.id, now)

  function saveTitle() {
    const next = title.trim()
    if (!next) {
      setDraft((current) => ({ ...current, title: issue.title }))
      return
    }
    if (next !== issue.title) updateIssue(issue.id, { title: next })
  }

  function saveDescription() {
    if (description !== issue.description) updateIssue(issue.id, { description })
  }

  function saveCause() {
    if (cause.trim() !== issue.cause) updateIssue(issue.id, { cause: cause.trim() })
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <TypeIcon type={issue.type} />
          <span className="font-mono text-xs tracking-wide">{issueKey(issue.number)}</span>
          <span>{typeLabel(issue.type)}</span>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close issue">
          <X />
        </Button>
      </div>

      <div className="harbor-scroll flex-1 space-y-5 overflow-y-auto px-4 py-4">
        <input
          value={title}
          onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
          onBlur={saveTitle}
          className="w-full bg-transparent text-lg font-medium tracking-tight outline-none"
          aria-label="Title"
        />

        <div className="grid grid-cols-2 gap-3">
          <FieldSelect
            label="Status"
            value={issue.status}
            options={STATUSES}
            onChange={(status) => updateIssue(issue.id, { status })}
          />
          <FieldSelect
            label="Priority"
            value={issue.priority}
            options={PRIORITIES}
            onChange={(priority) => updateIssue(issue.id, { priority })}
          />
          <FieldSelect
            label="Type"
            value={issue.type}
            options={TYPES}
            onChange={(type) => updateIssue(issue.id, { type })}
          />
          <div className="grid gap-1 text-xs text-muted-foreground">
            Time logged
            <div className="flex h-8 items-center justify-between rounded-lg border border-input bg-input/30 px-2.5 text-sm text-foreground">
              <span className="font-mono">{formatDuration(total)}</span>
              {running ? (
                <button className="inline-flex items-center gap-1 text-amber-200" onClick={() => stopTimer()}>
                  <Square className="size-3.5" /> Stop
                </button>
              ) : (
                <button className="inline-flex items-center gap-1 text-amber-200" onClick={() => startTimer(issue.id)}>
                  <Play className="size-3.5" /> Start
                </button>
              )}
            </div>
          </div>
        </div>

        <label className="grid gap-1.5 text-xs text-muted-foreground">
          {issue.type === "bug" ? "What caused it" : "Cause, if you know it"}
          <Input
            value={cause}
            list="harbor-causes"
            placeholder={issue.type === "bug" ? "The reason this broke" : "Optional"}
            onChange={(event) => setDraft((current) => ({ ...current, cause: event.target.value }))}
            onBlur={saveCause}
          />
          <datalist id="harbor-causes">
            {causes.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
          {issue.type === "bug" && !issue.cause.trim() ? (
            <span className="text-amber-200/90">Bugs without a cause are hard to spot later. Write the reason when you find it.</span>
          ) : null}
        </label>

        <label className="grid gap-1.5 text-xs text-muted-foreground">
          Notes
          <Textarea
            value={description}
            onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
            onBlur={saveDescription}
            placeholder="What happened, where, and what you tried."
            className="min-h-28"
          />
        </label>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Time on this issue</p>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <StatusIcon status={issue.status} />
              <PriorityMark priority={issue.priority} />
              {priorityLabel(issue.priority)}
            </span>
          </div>
          {entries.length === 0 ? (
            <p className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
              No time yet. Start the timer while you work, or log a block from the Time page.
            </p>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-lg border">
              {entries.map((entry) => (
                <li key={entry.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
                  <div>
                    <p className="font-mono text-sm">{formatDuration(entryDuration(entry, now))}</p>
                    <p className="text-xs text-muted-foreground">
                      {entry.endedAt === null ? "Running" : formatWhen(entry.startedAt)}
                      {entry.note ? ` · ${entry.note}` : ""}
                    </p>
                  </div>
                  {entry.endedAt !== null ? (
                    <Button variant="ghost" size="icon-xs" aria-label="Delete time entry" onClick={() => deleteEntry(entry.id)}>
                      <Trash2 />
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between border-t px-4 py-3">
        <p className="text-xs text-muted-foreground">Opened {formatWhen(issue.createdAt)}</p>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => {
            deleteIssue(issue.id)
            onClose()
            toast("Issue deleted")
          }}
        >
          <Trash2 />
          Delete
        </Button>
      </div>
    </div>
  )
}
