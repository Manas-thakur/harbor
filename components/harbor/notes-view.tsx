"use client"

import { useState } from "react"
import { CalendarDays, ChevronRight, FilePlus, Library, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { NoteEditor } from "@/components/harbor/note-editor"
import { childrenOf, notePlainText } from "@/lib/notes"
import { useStore } from "@/lib/store"
import { formatWhen } from "@/lib/format"
import { issueKey, type Note } from "@/lib/types"

export function NotesView({
  query,
  selectedId,
  onSelect,
  onOpenIssue,
}: {
  query: string
  selectedId: string | null
  onSelect: (id: string | null) => void
  onOpenIssue: (id: string) => void
}) {
  const { data, createNote, ensureDailyNote, moveNote } = useStore()
  const [mode, setMode] = useState<"page" | "table">("page")
  const [treeOpen, setTreeOpen] = useState(false)
  const note = data.notes.find((item) => item.id === selectedId) ?? null
  const needle = query.trim().toLowerCase()
  const matches = needle
    ? data.notes.filter((item) => notePlainText(item).toLowerCase().includes(needle))
    : data.notes

  function makePage(parentId: string | null = null) {
    const id = createNote({ title: "Untitled", parentId, icon: "📝" })
    onSelect(id)
    setMode("page")
    setTreeOpen(false)
  }

  return (
    <div className="flex min-h-0 flex-1">
      <aside className={`${treeOpen ? "absolute inset-0 z-20 flex" : "hidden"} w-full flex-col border-r bg-sidebar md:static md:flex md:w-60`}>
        <div className="flex items-center gap-1 px-2 py-2">
          <Button size="sm" variant="secondary" className="flex-1" onClick={() => makePage(null)}>
            <FilePlus /> New page
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Today's note"
            onClick={() => {
              onSelect(ensureDailyNote())
              setMode("page")
              setTreeOpen(false)
            }}
          >
            <CalendarDays />
          </Button>
        </div>
        <div className="flex gap-1 px-2 pb-2">
          <button className={`rounded-full px-2 py-1 text-xs ${mode === "page" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`} onClick={() => setMode("page")}>
            Pages
          </button>
          <button className={`rounded-full px-2 py-1 text-xs ${mode === "table" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`} onClick={() => { setMode("table"); onSelect(null) }}>
            <Library className="mr-1 inline size-3" /> Database
          </button>
        </div>
        <div className="harbor-scroll min-h-0 flex-1 overflow-y-auto px-1 pb-4">
          {needle ? (
            <ul>
              {matches.map((item) => (
                <li key={item.id}>
                  <PageButton note={item} active={item.id === selectedId} onClick={() => { onSelect(item.id); setMode("page"); setTreeOpen(false) }} />
                </li>
              ))}
            </ul>
          ) : (
            <>
              {data.notes.some((item) => item.pinned) ? (
                <p className="px-2 pt-2 pb-1 text-[11px] tracking-wide text-muted-foreground uppercase">Pinned</p>
              ) : null}
              {data.notes.filter((item) => item.pinned).map((item) => (
                <PageButton key={item.id} note={item} active={item.id === selectedId} onClick={() => { onSelect(item.id); setMode("page"); setTreeOpen(false) }} />
              ))}
              <p className="px-2 pt-3 pb-1 text-[11px] tracking-wide text-muted-foreground uppercase">Pages</p>
              <NoteTree
                notes={data.notes}
                parentId={null}
                depth={0}
                selectedId={selectedId}
                onSelect={(id) => { onSelect(id); setMode("page"); setTreeOpen(false) }}
                onMove={moveNote}
              />
            </>
          )}
        </div>
        <button className="border-t px-3 py-2 text-left text-xs text-muted-foreground md:hidden" onClick={() => setTreeOpen(false)}>
          Close pages
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b px-3 py-2 md:hidden">
          <Button size="sm" variant="outline" onClick={() => setTreeOpen(true)}>Pages</Button>
          <Button size="sm" variant="ghost" onClick={() => makePage(note?.id ?? null)}>New page</Button>
        </div>
        {mode === "table" ? (
          <Database notes={matches} issues={data.issues} onOpen={(id) => { onSelect(id); setMode("page") }} />
        ) : note ? (
          <NoteEditor note={note} onOpenNote={(id) => onSelect(id)} onOpenIssue={onOpenIssue} onDeleted={() => onSelect(null)} />
        ) : (
          <NotesHome
            notes={data.notes}
            onOpen={(id) => onSelect(id)}
            onCreate={() => makePage(null)}
            onToday={() => onSelect(ensureDailyNote())}
            onDatabase={() => setMode("table")}
          />
        )}
      </div>
    </div>
  )
}

function NotesHome({
  notes,
  onOpen,
  onCreate,
  onToday,
  onDatabase,
}: {
  notes: Note[]
  onOpen: (id: string) => void
  onCreate: () => void
  onToday: () => void
  onDatabase: () => void
}) {
  const recent = [...notes].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6)
  return (
    <div className="harbor-scroll flex-1 overflow-y-auto px-6 py-8">
      <div className="mx-auto max-w-2xl">
        <h2 className="text-2xl font-medium tracking-tight">Notes</h2>
        <p className="mt-2 max-w-lg text-sm text-muted-foreground">
          Nested pages, to-dos, and links that point at other pages or at Harbor issues. Type / in a page for blocks, and [[ to link.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button onClick={onCreate}>New page</Button>
          <Button variant="secondary" onClick={onToday}><CalendarDays /> Today</Button>
          <Button variant="outline" onClick={onDatabase}><Library /> All pages</Button>
        </div>
        <h3 className="mt-8 text-xs tracking-wide text-muted-foreground uppercase">Recent</h3>
        {recent.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No pages yet. Start with today, or a blank page.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border overflow-hidden rounded-xl border">
            {recent.map((note) => (
              <li key={note.id}>
                <button className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-muted/50" onClick={() => onOpen(note.id)}>
                  <span className="text-lg">{note.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{note.title}</span>
                    <span className="text-xs text-muted-foreground">{formatWhen(note.updatedAt)}</span>
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function Database({
  notes,
  issues,
  onOpen,
}: {
  notes: Note[]
  issues: { id: string; number: number; title: string }[]
  onOpen: (id: string) => void
}) {
  const rows = [...notes].sort((a, b) => b.updatedAt - a.updatedAt)
  return (
    <div className="harbor-scroll min-h-0 flex-1 overflow-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="sticky top-0 bg-background text-xs text-muted-foreground">
          <tr className="border-b">
            <th className="px-4 py-2 font-medium">Page</th>
            <th className="px-3 py-2 font-medium">Tags</th>
            <th className="px-3 py-2 font-medium">Issue</th>
            <th className="px-3 py-2 font-medium">Updated</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-4 py-8 text-muted-foreground">
                <Search className="mr-2 inline size-4" /> No pages match.
              </td>
            </tr>
          ) : (
            rows.map((note) => {
              const issue = issues.find((item) => item.id === note.issueId)
              return (
                <tr key={note.id} className="border-b hover:bg-muted/40">
                  <td className="px-4 py-2">
                    <button className="text-left hover:underline" onClick={() => onOpen(note.id)}>
                      {note.icon} {note.title}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{note.tags.map((tag) => `#${tag}`).join(" ")}</td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{issue ? issueKey(issue.number) : ""}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{formatWhen(note.updatedAt)}</td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}

function NoteTree({
  notes,
  parentId,
  depth,
  selectedId,
  onSelect,
  onMove,
}: {
  notes: Note[]
  parentId: string | null
  depth: number
  selectedId: string | null
  onSelect: (id: string) => void
  onMove: (id: string, parentId: string | null) => void
}) {
  const nodes = childrenOf(notes, parentId)
  return (
    <ul>
      {nodes.map((note) => (
        <li key={note.id}>
          <div
            draggable
            onDragStart={(event) => event.dataTransfer.setData("text/note", note.id)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault()
              event.stopPropagation()
              const id = event.dataTransfer.getData("text/note")
              if (id) onMove(id, note.id)
            }}
          >
            <PageButton note={note} depth={depth} active={note.id === selectedId} onClick={() => onSelect(note.id)} />
          </div>
          <NoteTree notes={notes} parentId={note.id} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} onMove={onMove} />
        </li>
      ))}
    </ul>
  )
}

function PageButton({ note, active, onClick, depth = 0 }: { note: Note; active: boolean; onClick: () => void; depth?: number }) {
  return (
    <button
      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${active ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/60"}`}
      style={{ paddingLeft: 8 + depth * 12 }}
      onClick={onClick}
    >
      <span>{note.icon}</span>
      <span className="truncate">{note.title}</span>
    </button>
  )
}
