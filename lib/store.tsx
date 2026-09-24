"use client"

import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react"
import { blankBlocks, isDescendant, renameLinks } from "@/lib/notes"
import { createSample } from "@/lib/sample"
import { defaultPomodoro, phaseLength, type Block, type Issue, type Note, type PomodoroPhase, type PomodoroState, type Priority, type IssueStatus, type IssueType, type StoreData, type TimeEntry } from "@/lib/types"
import { dayKey } from "@/lib/format"
import { isStoreData } from "@/lib/validate"

const LEGACY_KEY = "harbor.v1"

export type AccountUser = { id: string; name: string; email: string }
export type TeamSummary = { id: string; name: string; role: "owner" | "member" }
export type Member = { id: string; name: string; email: string; role: "owner" | "member" }

type Snapshot = {
  ready: boolean
  user: AccountUser | null
  teams: TeamSummary[]
  teamId: string | null
  teamName: string | null
  members: Member[]
  revision: number
  data: StoreData
}

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
  user: AccountUser | null
  teams: TeamSummary[]
  teamId: string | null
  teamName: string | null
  members: Member[]
  data: StoreData
  login: (email: string, password: string) => Promise<string | null>
  signup: (name: string, email: string, password: string) => Promise<string | null>
  logout: () => Promise<void>
  createTeam: (name: string) => Promise<string | null>
  joinTeam: (code: string) => Promise<string | null>
  switchTeam: (teamId: string) => Promise<void>
  inviteToTeam: () => Promise<string | null>
  removeMember: (memberId: string) => Promise<string | null>
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

const initialSnapshot: Snapshot = {
  ready: false,
  user: null,
  teams: [],
  teamId: null,
  teamName: null,
  members: [],
  revision: 0,
  data: emptyData(),
}

let snapshot: Snapshot = initialSnapshot
let dirty = false
let saving = false
let saveQueued = false
const listeners = new Set<() => void>()

function readClient() {
  return snapshot.data
}

function emit() {
  listeners.forEach((listener) => listener())
}

function commit(next: StoreData) {
  snapshot = { ...snapshot, data: next }
  dirty = true
  emit()
  scheduleSave()
}

let saveTimer = 0

function scheduleSave() {
  window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => void flushSave(), 200)
}

async function flushSave() {
  if (!snapshot.user || saving) {
    if (snapshot.user) saveQueued = true
    return
  }
  saving = true
  const revision = snapshot.revision
  const data = snapshot.data
  const sent = JSON.stringify(data)
  const response = await fetch("/api/workspace", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ revision, data }),
  })
  saving = false
  if (response.status === 409) {
    dirty = false
    await refreshWorkspace()
    return
  }
  if (response.ok) {
    const body = (await response.json()) as { revision: number }
    if (snapshot.revision === revision) {
      snapshot = { ...snapshot, revision: body.revision }
      dirty = JSON.stringify(snapshot.data) !== sent
      emit()
      if (dirty) saveQueued = true
    }
  }
  if (saveQueued) {
    saveQueued = false
    void flushSave()
  }
}

type RemotePayload = {
  user: AccountUser | null
  teams?: TeamSummary[]
  teamId?: string | null
  teamName?: string | null
  members?: Member[]
  revision?: number
  data?: StoreData | null
}

function applyRemote(payload: RemotePayload) {
  if (!payload.user) {
    snapshot = { ...initialSnapshot, ready: true }
    return
  }
  const data = payload.data ? withNotes(payload.data) : emptyData()
  snapshot = {
    ready: true,
    user: payload.user,
    teams: payload.teams ?? [],
    teamId: payload.teamId ?? null,
    teamName: payload.teamName ?? null,
    members: payload.members ?? [],
    revision: payload.revision ?? 0,
    data,
  }
}

function withNotes(data: StoreData): StoreData {
  return {
    issues: data.issues ?? [],
    entries: data.entries ?? [],
    notes: Array.isArray(data.notes) ? data.notes : [],
    pomodoro: data.pomodoro?.settings ? data.pomodoro : defaultPomodoro(),
    nextNumber: data.nextNumber || 1,
  }
}

async function refreshWorkspace() {
  const response = await fetch("/api/session")
  if (!response.ok) return
  const payload = (await response.json()) as RemotePayload
  if (dirty) return
  applyRemote(payload)
  emit()
}

function importLegacy() {
  if (snapshot.data.issues.length > 0 || snapshot.data.notes.length > 0) return
  try {
    const raw = localStorage.getItem(LEGACY_KEY)
    if (!raw) return
    const parsed: unknown = JSON.parse(raw)
    if (!isStoreData(parsed)) return
    commit(withNotes(parsed))
    localStorage.removeItem(LEGACY_KEY)
  } catch {
    return
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const StoreContext = createContext<StoreContextValue | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const state = useSyncExternalStore(subscribe, () => snapshot, () => initialSnapshot)

  useEffect(() => {
    let stop = false
    async function boot() {
      const response = await fetch("/api/session")
      if (stop) return
      const payload = (await response.json()) as RemotePayload
      applyRemote(payload)
      if (payload.user) importLegacy()
      emit()
    }
    void boot()
    const poll = window.setInterval(() => {
      if (snapshot.user && !dirty) void refreshWorkspace()
    }, 4000)
    return () => {
      stop = true
      window.clearInterval(poll)
    }
  }, [])

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
          userName: snapshot.user?.name,
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
      entries: [...prev.entries, { ...entry, id: crypto.randomUUID(), userName: entry.userName ?? snapshot.user?.name }],
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

  async function login(email: string, password: string) {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    })
    if (!response.ok) {
      const body = (await response.json()) as { error?: string }
      return body.error ?? "Could not log in."
    }
    await refreshWorkspace()
    importLegacy()
    return null
  }

  async function signup(name: string, email: string, password: string) {
    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    })
    if (!response.ok) {
      const body = (await response.json()) as { error?: string }
      return body.error ?? "Could not create the account."
    }
    await refreshWorkspace()
    importLegacy()
    return null
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" })
    dirty = false
    snapshot = { ...initialSnapshot, ready: true }
    emit()
  }

  async function teamAction(body: Record<string, string>) {
    const response = await fetch("/api/teams", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
    const payload = (await response.json()) as { error?: string; code?: string }
    if (!response.ok) return { error: payload.error ?? "That did not work.", code: null }
    dirty = false
    await refreshWorkspace()
    return { error: null, code: payload.code ?? null }
  }

  async function createTeam(name: string) {
    return (await teamAction({ action: "create", name })).error
  }

  async function joinTeam(code: string) {
    return (await teamAction({ action: "join", code })).error
  }

  async function switchTeam(teamId: string) {
    dirty = false
    await teamAction({ action: "switch", teamId })
  }

  async function inviteToTeam() {
    if (!snapshot.teamId) return null
    return (await teamAction({ action: "invite", teamId: snapshot.teamId })).code
  }

  async function removeMember(memberId: string) {
    if (!snapshot.teamId) return "No team."
    return (await teamAction({ action: "remove", teamId: snapshot.teamId, memberId })).error
  }

  return (
    <StoreContext.Provider
      value={{
        ready: state.ready,
        user: state.user,
        teams: state.teams,
        teamId: state.teamId,
        teamName: state.teamName,
        members: state.members,
        data: state.data,
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
        login,
        signup,
        logout,
        createTeam,
        joinTeam,
        switchTeam,
        inviteToTeam,
        removeMember,
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
