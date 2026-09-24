"use client"

import { formatDuration } from "@/lib/format"
import { issueKey, loggedMs, type Issue, type TimeEntry } from "@/lib/types"
import { StatusIcon } from "@/components/harbor/ui-bits"

export function CausesView({
  issues,
  entries,
  now,
  onOpenIssue,
}: {
  issues: Issue[]
  entries: TimeEntry[]
  now: number
  onOpenIssue: (id: string) => void
}) {
  const bugs = issues.filter((issue) => issue.type === "bug")
  const named = new Map<string, Issue[]>()
  const missing: Issue[] = []
  for (const bug of bugs) {
    const cause = bug.cause.trim()
    if (!cause) {
      missing.push(bug)
      continue
    }
    const list = named.get(cause) ?? []
    list.push(bug)
    named.set(cause, list)
  }
  const groups = [...named.entries()]
    .map(([cause, list]) => ({
      cause,
      bugs: list.sort((a, b) => b.updatedAt - a.updatedAt),
      time: list.reduce((sum, bug) => sum + loggedMs(entries, bug.id, now), 0),
    }))
    .sort((a, b) => b.bugs.length - a.bugs.length || b.time - a.time)

  if (bugs.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-center">
        <div>
          <p className="text-sm font-medium">No bugs yet</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            When you file a bug, write the cause. This page groups the ones that share a reason.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="harbor-scroll min-h-0 flex-1 overflow-y-auto p-4">
      <div className="mb-4 max-w-2xl">
        <h2 className="text-lg font-medium tracking-tight">Causes</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {bugs.length} bug{bugs.length === 1 ? "" : "s"}. Repeated causes are where the same mistake keeps showing up.
        </p>
      </div>
      <div className="grid gap-3">
        {groups.map((group) => (
          <section key={group.cause} className="rounded-xl border bg-card/40">
            <header className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-3">
              <h3 className="text-sm font-medium">{group.cause}</h3>
              <p className="text-xs text-muted-foreground">
                {group.bugs.length} bug{group.bugs.length === 1 ? "" : "s"} · {formatDuration(group.time)}
              </p>
            </header>
            <ul>
              {group.bugs.map((bug) => (
                <li key={bug.id}>
                  <button
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/50"
                    onClick={() => onOpenIssue(bug.id)}
                  >
                    <StatusIcon status={bug.status} />
                    <span className="w-14 shrink-0 font-mono text-xs text-muted-foreground">{issueKey(bug.number)}</span>
                    <span className="min-w-0 flex-1 truncate text-sm">{bug.title}</span>
                    <span className="font-mono text-xs text-muted-foreground">{formatDuration(loggedMs(entries, bug.id, now))}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {missing.length > 0 ? (
          <section className="rounded-xl border border-amber-300/30 bg-amber-300/5">
            <header className="border-b border-amber-300/20 px-4 py-3">
              <h3 className="text-sm font-medium text-amber-100">Still missing a cause</h3>
              <p className="mt-1 text-xs text-muted-foreground">Open one and write why it happened. Even a guess helps next time.</p>
            </header>
            <ul>
              {missing.map((bug) => (
                <li key={bug.id}>
                  <button
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-amber-300/10"
                    onClick={() => onOpenIssue(bug.id)}
                  >
                    <StatusIcon status={bug.status} />
                    <span className="w-14 shrink-0 font-mono text-xs text-muted-foreground">{issueKey(bug.number)}</span>
                    <span className="min-w-0 flex-1 truncate text-sm">{bug.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  )
}
