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

export type BlockType =
  | "paragraph"
  | "h1"
  | "h2"
  | "h3"
  | "bullet"
  | "number"
  | "todo"
  | "quote"
  | "callout"
  | "code"
  | "divider"
  | "toggle"

export type Block = {
  id: string
  type: BlockType
  text: string
  checked: boolean
  collapsed: boolean
}

export type Note = {
  id: string
  title: string
  icon: string
  parentId: string | null
  blocks: Block[]
  tags: string[]
  pinned: boolean
  issueId: string | null
  dailyDate: string | null
  sort: number
  createdAt: number
  updatedAt: number
}

export type PomodoroPhase = "focus" | "short" | "long"

export type PomodoroSettings = {
  focusMinutes: number
  shortMinutes: number
  longMinutes: number
  cycle: number
}

export type PomodoroLog = {
  id: string
  phase: PomodoroPhase
  issueId: string | null
  startedAt: number
  endedAt: number
}

export type PomodoroState = {
  settings: PomodoroSettings
  phase: PomodoroPhase
  issueId: string | null
  running: boolean
  endsAt: number | null
  remainingMs: number
  completedInCycle: number
  logs: PomodoroLog[]
}

export type StoreData = {
  issues: Issue[]
  entries: TimeEntry[]
  notes: Note[]
  pomodoro: PomodoroState
  nextNumber: number
}

export function defaultPomodoro(): PomodoroState {
  return {
    settings: { focusMinutes: 25, shortMinutes: 5, longMinutes: 15, cycle: 4 },
    phase: "focus",
    issueId: null,
    running: false,
    endsAt: null,
    remainingMs: 25 * 60_000,
    completedInCycle: 0,
    logs: [],
  }
}

export function phaseLength(state: PomodoroState) {
  const { settings, phase } = state
  const minutes = phase === "focus" ? settings.focusMinutes : phase === "short" ? settings.shortMinutes : settings.longMinutes
  return minutes * 60_000
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
