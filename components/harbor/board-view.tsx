"use client"

import { Play } from "lucide-react"
import { EmptyHint, PriorityMark, TypeIcon } from "@/components/harbor/ui-bits"
import { formatDuration } from "@/lib/format"
import { useStore } from "@/lib/store"
import { STATUSES, issueKey, loggedMs, type Issue, type IssueStatus } from "@/lib/types"

export function BoardView({
  issues,
  now,
  onSelect,
}: {
  issues: Issue[]
  now: number
  onSelect: (id: string) => void
}) {
  const { data, updateIssue, startTimer } = useStore()

  if (data.issues.length === 0) {
    return <EmptyHint title="The board is empty" body="Create an issue and it will land in a column." />
  }

  return (
    <div className="harbor-scroll grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-auto p-3 md:grid-cols-2 xl:grid-cols-4">
      {STATUSES.map((column) => {
        const cards = issues.filter((issue) => issue.status === column.id)
        return (
          <section
            key={column.id}
            className="flex min-h-48 flex-col rounded-xl border bg-card/40"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault()
              const id = event.dataTransfer.getData("text/plain")
              if (id) updateIssue(id, { status: column.id })
            }}
          >
            <header className="flex items-center justify-between px-3 py-2.5">
              <h2 className="text-sm font-medium">{column.label}</h2>
              <span className="font-mono text-xs text-muted-foreground">{cards.length}</span>
            </header>
            <div className="flex flex-1 flex-col gap-2 px-2 pb-2">
              {cards.length === 0 ? (
                <p className="px-2 py-6 text-center text-xs text-muted-foreground">Drop an issue here</p>
              ) : (
                cards.map((issue) => (
                  <article
                    key={issue.id}
                    draggable
                    onDragStart={(event) => event.dataTransfer.setData("text/plain", issue.id)}
                    className="cursor-grab rounded-lg border bg-background p-3 active:cursor-grabbing"
                  >
                    <button className="w-full text-left" onClick={() => onSelect(issue.id)}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] text-muted-foreground">{issueKey(issue.number)}</span>
                        <PriorityMark priority={issue.priority} />
                      </div>
                      <p className="mt-1 text-sm leading-snug">{issue.title}</p>
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <TypeIcon type={issue.type} />
                        {issue.type === "bug" ? (
                          <span className={`truncate ${issue.cause.trim() ? "" : "text-amber-200/90"}`}>
                            {issue.cause.trim() || "No cause yet"}
                          </span>
                        ) : (
                          <span>{formatDuration(loggedMs(data.entries, issue.id, now))}</span>
                        )}
                      </div>
                    </button>
                    <button
                      className="mt-2 inline-flex items-center gap-1 text-xs text-amber-200"
                      onClick={() => startTimer(issue.id)}
                    >
                      <Play className="size-3" />
                      {formatDuration(loggedMs(data.entries, issue.id, now))}
                    </button>
                  </article>
                ))
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}

export type { IssueStatus }
