"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Clock3,
  Download,
  GitBranch,
  LayoutGrid,
  List,
  Menu,
  Plus,
  Search,
  Square,
  Upload,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { BoardView } from "@/components/harbor/board-view"
import { CausesView } from "@/components/harbor/causes-view"
import { IssueDetail } from "@/components/harbor/issue-detail"
import { IssueList, QUICK_FILTERS, SORTS, filterIssues, sortIssues, type QuickFilter, type SortKey } from "@/components/harbor/issues-view"
import { TimeView } from "@/components/harbor/time-view"
import { useStore } from "@/lib/store"
import { dayKey, formatClock, formatDuration, startOfDay } from "@/lib/format"
import { isStoreData } from "@/lib/validate"
import { PRIORITIES, TYPES, issueKey, type IssueStatus, type IssueType, type Priority, type StoreData } from "@/lib/types"

type View = "issues" | "board" | "time" | "causes"

export function App() {
  const store = useStore()
  const [view, setView] = useState<View>("issues")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [quick, setQuick] = useState<QuickFilter>("open")
  const [sort, setSort] = useState<SortKey>("updated")
  const [creating, setCreating] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [desktop, setDesktop] = useState(true)
  const [now, setNow] = useState(() => Date.now())

  const running = store.data.entries.find((entry) => entry.endedAt === null)

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)")
    const apply = () => setDesktop(media.matches)
    apply()
    media.addEventListener("change", apply)
    return () => media.removeEventListener("change", apply)
  }, [])

  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [running])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)
      if (event.key === "Escape") {
        setSelectedId(null)
        setCreating(false)
        return
      }
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key === "c") {
        event.preventDefault()
        setCreating(true)
      }
      if (event.key === "/") {
        event.preventDefault()
        document.getElementById("harbor-search")?.focus()
      }
      if (event.key === "t" && selectedId) {
        event.preventDefault()
        const active = store.data.entries.find((entry) => entry.endedAt === null)
        if (active?.issueId === selectedId) store.stopTimer()
        else store.startTimer(selectedId)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [selectedId, store])

  const visible = useMemo(() => {
    const filtered = filterIssues(store.data.issues, view === "board" ? "all" : quick, query)
    return sortIssues(filtered, sort, store.data.entries, now)
  }, [store.data.issues, store.data.entries, quick, query, sort, view, now])

  const selected = store.data.issues.find((issue) => issue.id === selectedId) ?? null

  function openIssue(id: string) {
    setSelectedId(id)
    if (view === "time" || view === "causes") setView("issues")
  }

  const todayMs = store.data.entries.reduce((sum, entry) => {
    const end = entry.endedAt ?? now
    const from = Math.max(entry.startedAt, startOfDay(now))
    return sum + Math.max(0, Math.min(end, startOfDay(now) + 86_400_000) - from)
  }, 0)

  const openBugs = store.data.issues.filter((issue) => issue.type === "bug" && issue.status !== "done").length
  const uncaused = store.data.issues.filter((issue) => issue.type === "bug" && !issue.cause.trim() && issue.status !== "done").length

  if (!store.ready) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <p className="font-mono text-sm text-muted-foreground">Opening Harbor…</p>
      </div>
    )
  }

  const sidebar = (
    <Sidebar
      view={view}
      openBugs={openBugs}
      uncaused={uncaused}
      todayMs={todayMs}
      onView={(next) => {
        setView(next)
        setMenuOpen(false)
      }}
      onSample={() => {
        store.loadSample()
        toast("Sample workspace loaded")
      }}
      onClear={() => setConfirmClear(true)}
      onExport={() => exportData(store.data)}
      onImport={(next) => {
        store.replaceData(next)
        toast("Workspace imported")
      }}
    />
  )

  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground">
      <aside className="hidden w-60 shrink-0 border-r border-sidebar-border bg-sidebar lg:flex lg:flex-col">{sidebar}</aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b px-3 py-2">
          <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Open menu">
            <Menu />
          </Button>
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="harbor-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search issues, causes, notes"
              className="pl-8"
            />
          </div>
          {running ? (
            <button
              className="hidden items-center gap-2 rounded-full border border-amber-300/40 bg-amber-300/10 px-3 py-1 text-sm text-amber-50 sm:flex"
              onClick={() => openIssue(running.issueId)}
            >
              <span className="font-mono text-xs">{formatClock(now - running.startedAt)}</span>
              <span className="max-w-40 truncate text-xs">{runningTitle(store.data.issues, running.issueId)}</span>
              <span
                className="inline-flex items-center gap-1 text-xs"
                onClick={(event) => {
                  event.stopPropagation()
                  store.stopTimer()
                }}
              >
                <Square className="size-3" /> Stop
              </span>
            </button>
          ) : null}
          <Button onClick={() => setCreating(true)}>
            <Plus />
            <span className="hidden sm:inline">New issue</span>
          </Button>
        </header>

        {view === "issues" || view === "board" ? (
          <div className="flex items-center gap-2 overflow-x-auto border-b px-3 py-2">
            {view === "issues"
              ? QUICK_FILTERS.map((filter) => (
                  <button
                    key={filter.id}
                    onClick={() => setQuick(filter.id)}
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs ${
                      quick === filter.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {filter.label}
                    {filter.id === "uncaused" && uncaused > 0 ? ` ${uncaused}` : ""}
                  </button>
                ))
              : <p className="text-xs text-muted-foreground">Drag a card to change its status.</p>}
            <div className="ml-auto">
              <select
                aria-label="Sort"
                className="h-7 rounded-lg border border-input bg-transparent px-2 text-xs"
                value={sort}
                onChange={(event) => setSort(event.target.value as SortKey)}
              >
                {SORTS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1">
          <div className="flex min-w-0 flex-1 flex-col">
            {view === "issues" ? (
              <IssueList issues={visible} selectedId={selectedId} now={now} onSelect={setSelectedId} />
            ) : null}
            {view === "board" ? <BoardView issues={visible} now={now} onSelect={setSelectedId} /> : null}
            {view === "time" ? <TimeView now={now} onOpenIssue={openIssue} /> : null}
            {view === "causes" ? (
              <CausesView issues={store.data.issues} entries={store.data.entries} now={now} onOpenIssue={openIssue} />
            ) : null}
          </div>
          {desktop && selected && (view === "issues" || view === "board") ? (
            <aside className="hidden w-[420px] shrink-0 border-l lg:block">
              <IssueDetail issue={selected} now={now} onClose={() => setSelectedId(null)} />
            </aside>
          ) : null}
        </div>
      </div>

      {!desktop && selected ? (
        <div className="fixed inset-0 z-40 bg-background">
          <IssueDetail issue={selected} now={now} onClose={() => setSelectedId(null)} />
        </div>
      ) : null}

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-72 bg-sidebar p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>
          {sidebar}
        </SheetContent>
      </Sheet>

      <NewIssueDialog
        open={creating}
        onOpenChange={setCreating}
        onCreate={(id) => {
          setSelectedId(id)
          setView("issues")
        }}
      />

      <Dialog open={confirmClear} onOpenChange={setConfirmClear}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear this workspace?</DialogTitle>
            <DialogDescription>Issues and time logs in this browser will be removed. Export first if you want a copy.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmClear(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                store.clearAll()
                setSelectedId(null)
                setConfirmClear(false)
                toast("Workspace cleared")
              }}
            >
              Clear everything
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Sidebar({
  view,
  openBugs,
  uncaused,
  todayMs,
  onView,
  onSample,
  onClear,
  onExport,
  onImport,
}: {
  view: View
  openBugs: number
  uncaused: number
  todayMs: number
  onView: (view: View) => void
  onSample: () => void
  onClear: () => void
  onExport: () => void
  onImport: (data: StoreData) => void
}) {
  const items: { id: View; label: string; icon: typeof List; hint?: string }[] = [
    { id: "issues", label: "Issues", icon: List },
    { id: "board", label: "Board", icon: LayoutGrid },
    { id: "time", label: "Time", icon: Clock3 },
    { id: "causes", label: "Causes", icon: GitBranch, hint: uncaused ? String(uncaused) : undefined },
  ]
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-5 pb-4">
        <p className="text-lg font-medium tracking-tight">Harbor</p>
        <p className="text-xs text-muted-foreground">Your issues, causes, and hours.</p>
      </div>
      <nav className="flex flex-col gap-0.5 px-2">
        {items.map((item) => {
          const Icon = item.icon
          const active = view === item.id
          return (
            <button
              key={item.id}
              onClick={() => onView(item.id)}
              className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm ${active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"}`}
            >
              <Icon className="size-4" />
              <span className="flex-1 text-left">{item.label}</span>
              {item.hint ? <span className="font-mono text-[11px] text-amber-200">{item.hint}</span> : null}
            </button>
          )
        })}
      </nav>
      <div className="mx-4 mt-6 rounded-xl border border-sidebar-border px-3 py-3">
        <p className="text-[11px] tracking-wide text-muted-foreground uppercase">Today</p>
        <p className="mt-1 font-mono text-xl">{formatDuration(todayMs)}</p>
        <p className="mt-2 text-xs text-muted-foreground">{openBugs} open bug{openBugs === 1 ? "" : "s"}</p>
      </div>
      <div className="mt-auto flex flex-col gap-1 px-3 py-4 text-xs">
        <button className="flex items-center gap-2 rounded-md px-2 py-1.5 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground" onClick={onExport}>
          <Download className="size-3.5" /> Export
        </button>
        <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground">
          <Upload className="size-3.5" /> Import
          <input
            type="file"
            accept="application/json"
            className="hidden"
            onChange={async (event) => {
              const file = event.target.files?.[0]
              event.target.value = ""
              if (!file) return
              try {
                const parsed: unknown = JSON.parse(await file.text())
                if (!isStoreData(parsed)) {
                  toast.error("That file is not a Harbor workspace.")
                  return
                }
                onImport(parsed)
              } catch {
                toast.error("Could not read that file.")
              }
            }}
          />
        </label>
        <button className="rounded-md px-2 py-1.5 text-left text-muted-foreground hover:bg-sidebar-accent hover:text-foreground" onClick={onSample}>
          Load sample workspace
        </button>
        <button className="rounded-md px-2 py-1.5 text-left text-muted-foreground hover:bg-sidebar-accent hover:text-foreground" onClick={onClear}>
          Clear workspace
        </button>
      </div>
    </div>
  )
}

function NewIssueDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (id: string) => void
}) {
  const { createIssue } = useStore()
  const [title, setTitle] = useState("")
  const [type, setType] = useState<IssueType>("bug")
  const [priority, setPriority] = useState<Priority>("medium")
  const [status, setStatus] = useState<IssueStatus>("todo")
  const [cause, setCause] = useState("")

  function reset() {
    setTitle("")
    setType("bug")
    setPriority("medium")
    setStatus("todo")
    setCause("")
  }

  function submit() {
    if (!title.trim()) return
    const id = createIssue({ title, type, priority, status, cause })
    reset()
    onOpenChange(false)
    onCreate(id)
    toast("Issue created")
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) reset()
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New issue</DialogTitle>
          <DialogDescription>A bug, a task, or something you want to improve. Press C anywhere to open this.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
        >
          <Input
            autoFocus
            value={title}
            placeholder="What needs tracking?"
            onChange={(event) => setTitle(event.target.value)}
          />
          <div className="flex flex-wrap gap-1.5">
            {TYPES.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setType(item.id)}
                className={`rounded-full px-2.5 py-1 text-xs ${type === item.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1 text-xs text-muted-foreground">
              Priority
              <select className="h-8 rounded-lg border border-input bg-input/30 px-2 text-sm" value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>
                {PRIORITIES.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs text-muted-foreground">
              Status
              <select className="h-8 rounded-lg border border-input bg-input/30 px-2 text-sm" value={status} onChange={(event) => setStatus(event.target.value as IssueStatus)}>
                <option value="backlog">Backlog</option>
                <option value="todo">To do</option>
                <option value="in_progress">In progress</option>
                <option value="done">Done</option>
              </select>
            </label>
          </div>
          {type === "bug" ? (
            <label className="grid gap-1 text-xs text-muted-foreground">
              Cause, if you already know it
              <Input value={cause} placeholder="You can fill this in later" onChange={(event) => setCause(event.target.value)} />
            </label>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!title.trim()}>Create</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function runningTitle(issues: { id: string; number: number; title: string }[], id: string) {
  const issue = issues.find((item) => item.id === id)
  return issue ? `${issueKey(issue.number)} ${issue.title}` : "Timer"
}

function exportData(data: StoreData) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `harbor-${dayKey(Date.now())}.json`
  link.click()
  URL.revokeObjectURL(url)
  toast("Workspace exported")
}
