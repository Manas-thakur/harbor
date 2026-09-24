"use client"

import {
  createContext,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react"
import { blankBlocks, isDescendant, renameLinks } from "@/lib/notes"
import { createSample, sampleNotes } from "@/lib/sample"
import { defaultPomodoro, phaseLength, type Block, type Issue, type Note, type PomodoroPhase, type PomodoroState, type Priority, type IssueStatus, type IssueType, type StoreData, type TimeEntry } from "@/lib/types"
import { dayKey } from "@/lib/format"
import { isStoreData } from "@/lib/validate"

const STORAGE_KEY = "harbor.v1"

type NewIssue = {
  title: string
  type: IssueType
  status: IssueStatus
  priority: Priority
  cause: string
  description?: string
}

type StoreContextValue = {
  ready: boolean
  data: StoreData
  createIssue: (input: NewIssue) => string
  updateIssue: (id: string, patch: Partial<Issue>) => void
  deleteIssue: (id: string) => void
  startTimer: (issueId: string) => void
  stopTimer: () => void
  addEntry: (entry: Omit<TimeEntry, "id">) => void
  deleteEntry: (id: string) => void
  replaceData: (next: StoreData) => void
  loadSample: () => void
  clearAll: () => void
  createNote: (input: Partial<Note> & { title: string }) => string
  updateNote: (id: string, patch: Partial<Note>) => void
  deleteNote: (id: string) => void
  moveNote: (id: string, parentId: string | null) => void
  ensureDailyNote: () => string
  startPomodoro: () => void
  pausePomodoro: () => void
  resetPomodoro: () => void
  skipPomodoro: () => void
  completePomodoro: () => void
  setPomodoro: (patch: { issueId?: string | null; settings?: Partial<PomodoroState["settings"]> }) => void
}

const emptyData = (): StoreData => ({ issues: [], entries: [], notes: [], pomodoro: defaultPomodoro(), nextNumber: 1 })
const serverData = emptyData()

let current: StoreData | null = null
const listeners = new Set<() => void>()

function load(): StoreData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return isStoreData(parsed) ? parsed : null
  } catch {
    return null
  }
}

function withNotes(data: StoreData): StoreData {
  const notes = Array.isArray(data.notes) ? data.notes : sampleNotes()
  const pomodoro = data.pomodoro?.settings ? data.pomodoro : defaultPomodoro()
  return { ...data, notes, pomodoro }
}

function readClient() {
  if (current) return current
  const stored = load()
  const next = withNotes(stored ?? createSample())
  current = next
  const needsSave = !stored || !Array.isArray(stored.notes) || !stored.pomodoro?.settings
  if (needsSave) localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  return current
}

function commit(next: StoreData) {
  current = next
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const StoreContext = createContext<StoreContextValue | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const data = useSyncExternalStore(subscribe, readClient, () => serverData)
  const ready = useSyncExternalStore(subscribe, () => true, () => false)

  function mutate(recipe: (prev: StoreData) => StoreData) {
    commit(recipe(readClient()))
  }

  function createIssue(input: NewIssue) {
    const id = crypto.randomUUID()
    const now = Date.now()
    mutate((prev) => {
      const issue: Issue = {
        id,
        number: prev.nextNumber,
        title: input.title.trim(),
        description: input.description?.trim() ?? "",
        type: input.type,
        status: input.status,
        priority: input.priority,
        cause: input.type === "bug" ? input.cause.trim() : input.cause.trim(),
        createdAt: now,
        updatedAt: now,
        completedAt: input.status === "done" ? now : null,
      }
      return {
        ...prev,
        nextNumber: prev.nextNumber + 1,
        issues: [issue, ...prev.issues],
      }
    })
    return id
  }

  function updateIssue(id: string, patch: Partial<Issue>) {
    const now = Date.now()
    mutate((prev) => ({
      ...prev,
      issues: prev.issues.map((issue) => {
        if (issue.id !== id) return issue
        const status = patch.status ?? issue.status
        const completedAt = status !== "done" ? null : issue.completedAt ?? now
        return {
          ...issue,
          ...patch,
          id: issue.id,
          number: issue.number,
          createdAt: issue.createdAt,
          updatedAt: now,
          completedAt,
        }
      }),
    }))
  }

  function deleteIssue(id: string) {
    mutate((prev) => ({
      ...prev,
      issues: prev.issues.filter((issue) => issue.id !== id),
      entries: prev.entries.filter((entry) => entry.issueId !== id),
      notes: prev.notes.map((note) => (note.issueId === id ? { ...note, issueId: null } : note)),
    }))
  }

  function startTimer(issueId: string) {
    const now = Date.now()
    mutate((prev) => ({
      ...prev,
      entries: [
        ...prev.entries.map((entry) => (entry.endedAt === null ? { ...entry, endedAt: now } : entry)),
        {
          id: crypto.randomUUID(),
          issueId,
          startedAt: now,
          endedAt: null,
          note: "",
        },
      ],
      issues: prev.issues.map((issue) =>
        issue.id === issueId ? { ...issue, updatedAt: now, status: issue.status === "backlog" || issue.status === "todo" ? "in_progress" : issue.status } : issue
      ),
    }))
  }

  function stopTimer() {
    const now = Date.now()
    mutate((prev) => ({
      ...prev,
      entries: prev.entries.map((entry) => (entry.endedAt === null ? { ...entry, endedAt: now } : entry)),
    }))
  }

  function addEntry(entry: Omit<TimeEntry, "id">) {
    mutate((prev) => ({
      ...prev,
      entries: [...prev.entries, { ...entry, id: crypto.randomUUID() }],
    }))
  }

  function deleteEntry(id: string) {
    mutate((prev) => ({
      ...prev,
      entries: prev.entries.filter((entry) => entry.id !== id),
    }))
  }

  function replaceData(next: StoreData) {
    commit(next)
  }

  function loadSample() {
    commit(createSample())
  }

  function clearAll() {
    commit(emptyData())
  }

  function createNote(input: Partial<Note> & { title: string }) {
    const id = crypto.randomUUID()
    const now = Date.now()
    mutate((prev) => {
      const siblings = prev.notes.filter((note) => note.parentId === (input.parentId ?? null))
      const note: Note = {
        id,
        title: input.title.trim() || "Untitled",
        icon: input.icon ?? "📝",
        parentId: input.parentId ?? null,
        blocks: input.blocks?.length ? input.blocks : blankBlocks(),
        tags: input.tags ?? [],
        pinned: input.pinned ?? false,
        issueId: input.issueId ?? null,
        dailyDate: input.dailyDate ?? null,
        sort: siblings.length,
        createdAt: now,
        updatedAt: now,
      }
      return { ...prev, notes: [note, ...prev.notes] }
    })
    return id
  }

  function updateNote(id: string, patch: Partial<Note>) {
    const now = Date.now()
    mutate((prev) => {
      const currentNote = prev.notes.find((note) => note.id === id)
      let notes = prev.notes
      if (currentNote && patch.title && patch.title !== currentNote.title) {
        notes = renameLinks(notes, currentNote.title, patch.title)
      }
      return {
        ...prev,
        notes: notes.map((note) => (note.id === id ? { ...note, ...patch, id: note.id, createdAt: note.createdAt, updatedAt: now } : note)),
      }
    })
  }

  function deleteNote(id: string) {
    mutate((prev) => {
      const target = prev.notes.find((note) => note.id === id)
      return {
        ...prev,
        notes: prev.notes
          .filter((note) => note.id !== id)
          .map((note) => (note.parentId === id ? { ...note, parentId: target?.parentId ?? null } : note)),
      }
    })
  }

  function moveNote(id: string, parentId: string | null) {
    mutate((prev) => {
      if (parentId && (parentId === id || isDescendant(prev.notes, id, parentId))) return prev
      return {
        ...prev,
        notes: prev.notes.map((note) => (note.id === id ? { ...note, parentId, updatedAt: Date.now() } : note)),
      }
    })
  }

  function ensureDailyNote() {
    const date = dayKey(Date.now())
    const existing = readClient().notes.find((note) => note.dailyDate === date)
    if (existing) return existing.id
    const label = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })
    return createNote({
      title: label,
      icon: "🗓️",
      dailyDate: date,
      tags: ["daily"],
      blocks: [
        { id: crypto.randomUUID(), type: "h2", text: "Plan", checked: false, collapsed: false },
        { id: crypto.randomUUID(), type: "todo", text: "", checked: false, collapsed: false },
        { id: crypto.randomUUID(), type: "h2", text: "Notes", checked: false, collapsed: false },
        { id: crypto.randomUUID(), type: "paragraph", text: "", checked: false, collapsed: false },
      ] satisfies Block[],
    })
  }

  function stopFocusTimer() {
    const running = readClient().entries.some((entry) => entry.endedAt === null)
    if (running) stopTimer()
  }

  function nextPhase(state: PomodoroState): PomodoroState {
    if (state.phase === "focus") {
      const completed = state.completedInCycle + 1
      const long = completed >= state.settings.cycle
      const phase: PomodoroPhase = long ? "long" : "short"
      const next = { ...state, phase, completedInCycle: long ? 0 : completed, running: false, endsAt: null }
      return { ...next, remainingMs: phaseLength(next) }
    }
    const next = { ...state, phase: "focus" as const, running: false, endsAt: null }
    return { ...next, remainingMs: phaseLength(next) }
  }

  function startPomodoro() {
    const now = Date.now()
    const state = readClient().pomodoro
    if (state.phase === "focus" && state.issueId) startTimer(state.issueId)
    mutate((prev) => ({
      ...prev,
      pomodoro: {
        ...prev.pomodoro,
        running: true,
        endsAt: now + prev.pomodoro.remainingMs,
      },
    }))
  }

  function pausePomodoro() {
    const now = Date.now()
    stopFocusTimer()
    mutate((prev) => {
      const remaining = prev.pomodoro.endsAt ? Math.max(0, prev.pomodoro.endsAt - now) : prev.pomodoro.remainingMs
      return { ...prev, pomodoro: { ...prev.pomodoro, running: false, endsAt: null, remainingMs: remaining } }
    })
  }

  function resetPomodoro() {
    stopFocusTimer()
    mutate((prev) => {
      const next = { ...prev.pomodoro, phase: "focus" as const, running: false, endsAt: null, completedInCycle: 0 }
      return { ...prev, pomodoro: { ...next, remainingMs: phaseLength(next) } }
    })
  }

  function skipPomodoro() {
    stopFocusTimer()
    mutate((prev) => ({ ...prev, pomodoro: nextPhase(prev.pomodoro) }))
  }

  function completePomodoro() {
    const now = Date.now()
    mutate((prev) => {
      if (!prev.pomodoro.running || !prev.pomodoro.endsAt || prev.pomodoro.endsAt > now) return prev
      const startedAt = prev.pomodoro.endsAt - phaseLength(prev.pomodoro)
      const log = {
        id: crypto.randomUUID(),
        phase: prev.pomodoro.phase,
        issueId: prev.pomodoro.issueId,
        startedAt,
        endedAt: now,
      }
      const advanced = nextPhase(prev.pomodoro)
      const auto = {
        ...advanced,
        running: true,
        endsAt: now + advanced.remainingMs,
      }
      return { ...prev, pomodoro: { ...auto, logs: [log, ...prev.pomodoro.logs].slice(0, 40) } }
    })
    const after = readClient().pomodoro
    if (after.running && after.phase !== "focus") stopFocusTimer()
    if (after.running && after.phase === "focus" && after.issueId) startTimer(after.issueId)
  }

  function setPomodoro(patch: { issueId?: string | null; settings?: Partial<PomodoroState["settings"]> }) {
    mutate((prev) => {
      const settings = { ...prev.pomodoro.settings, ...patch.settings }
      const next = { ...prev.pomodoro, ...patch, settings }
      const untouched = prev.pomodoro.remainingMs === phaseLength(prev.pomodoro)
      const remainingMs = prev.pomodoro.running || !untouched ? prev.pomodoro.remainingMs : phaseLength(next)
      return { ...prev, pomodoro: { ...next, remainingMs, endsAt: prev.pomodoro.running ? prev.pomodoro.endsAt : null } }
    })
  }

  return (
    <StoreContext.Provider
      value={{
        ready,
        data,
        createIssue,
        updateIssue,
        deleteIssue,
        startTimer,
        stopTimer,
        addEntry,
        deleteEntry,
        replaceData,
        loadSample,
        clearAll,
        createNote,
        updateNote,
        deleteNote,
        moveNote,
        ensureDailyNote,
        startPomodoro,
        pausePomodoro,
        resetPomodoro,
        skipPomodoro,
        completePomodoro,
        setPomodoro,
      }}
    >
      {children}
    </StoreContext.Provider>
  )
}

export function useStore() {
  const value = useContext(StoreContext)
  if (!value) throw new Error("useStore must be used inside StoreProvider")
  return value
}
