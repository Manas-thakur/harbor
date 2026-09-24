"use client"

import {
  createContext,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react"
import { createSample } from "@/lib/sample"
import type { Issue, Priority, IssueStatus, IssueType, StoreData, TimeEntry } from "@/lib/types"
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
}

const emptyData = (): StoreData => ({ issues: [], entries: [], nextNumber: 1 })
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

function readClient() {
  if (current) return current
  const stored = load()
  current = stored ?? createSample()
  if (!stored) localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
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
