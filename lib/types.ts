export type IssueType = "bug" | "task" | "improvement"
export type IssueStatus = "backlog" | "todo" | "in_progress" | "done"
export type Priority = "none" | "low" | "medium" | "high" | "urgent"

export type Issue = {
  id: string
  number: number
  title: string
  description: string
  type: IssueType
  status: IssueStatus
  priority: Priority
  cause: string
  createdAt: number
  updatedAt: number
  completedAt: number | null
}

export type TimeEntry = {
  id: string
  issueId: string
  startedAt: number
  endedAt: number | null
  note: string
}

export type StoreData = {
  issues: Issue[]
  entries: TimeEntry[]
  nextNumber: number
}

export const TYPES: { id: IssueType; label: string }[] = [
  { id: "bug", label: "Bug" },
  { id: "task", label: "Task" },
  { id: "improvement", label: "Improvement" },
]

export const STATUSES: { id: IssueStatus; label: string }[] = [
  { id: "backlog", label: "Backlog" },
  { id: "todo", label: "To do" },
  { id: "in_progress", label: "In progress" },
  { id: "done", label: "Done" },
]

export const PRIORITIES: { id: Priority; label: string }[] = [
  { id: "none", label: "No priority" },
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
  { id: "urgent", label: "Urgent" },
]

export const PRIORITY_RANK: Record<Priority, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
  none: 0,
}

export function issueKey(number: number) {
  return `HBR-${number}`
}

export function entryDuration(entry: TimeEntry, now: number) {
  const end = entry.endedAt ?? now
  return Math.max(0, end - entry.startedAt)
}

export function loggedMs(entries: TimeEntry[], issueId: string, now: number) {
  return entries
    .filter((entry) => entry.issueId === issueId)
    .reduce((sum, entry) => sum + entryDuration(entry, now), 0)
}
