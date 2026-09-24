"use client"

import { useEffect, useRef, useState } from "react"
import { Check, ChevronRight, Pin, PinOff, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  BLOCK_COMMANDS,
  backlinks,
  childrenOf,
  linkedTitles,
  makeBlock,
  outgoingTitles,
  resolveLink,
  toMarkdown,
} from "@/lib/notes"
import { useStore } from "@/lib/store"
import { issueKey, type Block, type BlockType, type Note } from "@/lib/types"

const ICONS = ["📝", "🐛", "🗓️", "✨", "📌", "🧭", "💡", "📎"]

export function NoteEditor({
  note,
  onOpenNote,
  onOpenIssue,
  onDeleted,
}: {
  note: Note
  onOpenNote: (id: string) => void
  onOpenIssue: (id: string) => void
  onDeleted: () => void
}) {
  const { data, updateNote, deleteNote, createNote, ensureDailyNote } = useStore()
  const [blocks, setBlocks] = useState(note.blocks)
  const [title, setTitle] = useState(note.title)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [tagDraft, setTagDraft] = useState("")
  const saveTimer = useRef<number | null>(null)
  const noteId = note.id

  const [pageId, setPageId] = useState(note.id)
  if (pageId !== note.id) {
    setPageId(note.id)
    setBlocks(note.blocks)
    setTitle(note.title)
    setFocusId(null)
  }

  useEffect(() => {
    if (!focusId) return
    document.getElementById(`block-${focusId}`)?.focus()
  }, [focusId])

  function persistBlocks(next: Block[], immediate = false) {
    setBlocks(next)
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    if (immediate) {
      updateNote(noteId, { blocks: next })
      return
    }
    saveTimer.current = window.setTimeout(() => updateNote(noteId, { blocks: next }), 280)
  }

  function updateBlock(id: string, patch: Partial<Block>, immediate = false) {
    persistBlocks(blocks.map((block) => (block.id === id ? { ...block, ...patch } : block)), immediate)
  }

  function insertAfter(id: string, type: BlockType = "paragraph", text = "") {
    const block = makeBlock(type, text)
    const index = blocks.findIndex((item) => item.id === id)
    const next = [...blocks]
    next.splice(index + 1, 0, block)
    persistBlocks(next.length ? next : [block], true)
    setFocusId(block.id)
  }

  function removeBlock(id: string) {
    const index = blocks.findIndex((item) => item.id === id)
    const next = blocks.filter((block) => block.id !== id)
    const fallback = next[index - 1] ?? next[0]
    persistBlocks(next.length ? next : [makeBlock()], true)
    if (fallback) setFocusId(fallback.id)
  }

  const crumbs = breadcrumb(data.notes, note)
  const linksOut = outgoingTitles({ ...note, blocks })
  const linksIn = backlinks(data.notes, note.title)
  const subpages = childrenOf(data.notes, note.id)
  const active = blocks.find((block) => block.id === focusId)
  const slashQuery = active && active.text.startsWith("/") ? active.text.slice(1).toLowerCase() : null
  const linkQuery = active ? trailingLink(active.text) : null

  return (
    <div className="harbor-scroll min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-3xl flex-col px-5 py-6 lg:px-10">
        <div className="mb-3 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          {crumbs.map((crumb, index) => (
            <span key={crumb.id} className="flex items-center gap-1">
              {index > 0 ? <ChevronRight className="size-3" /> : null}
              <button className="hover:text-foreground" onClick={() => onOpenNote(crumb.id)}>
                {crumb.icon} {crumb.title}
              </button>
            </span>
          ))}
        </div>

        <div className="mb-2 flex items-start gap-2">
          <button
            className="mt-1 text-2xl"
            aria-label="Change icon"
            onClick={() => {
              const index = ICONS.indexOf(note.icon)
              updateNote(note.id, { icon: ICONS[(index + 1) % ICONS.length] })
            }}
          >
            {note.icon}
          </button>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={() => {
              const next = title.trim() || "Untitled"
              setTitle(next)
              if (next !== note.title) updateNote(note.id, { title: next })
            }}
            className="w-full bg-transparent text-3xl font-medium tracking-tight outline-none"
            aria-label="Page title"
          />
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-2 text-xs">
          <button
            className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-muted-foreground"
            onClick={() => updateNote(note.id, { pinned: !note.pinned })}
          >
            {note.pinned ? <PinOff className="size-3" /> : <Pin className="size-3" />}
            {note.pinned ? "Pinned" : "Pin"}
          </button>
          <select
            className="h-7 rounded-full border border-input bg-transparent px-2 text-xs"
            value={note.issueId ?? ""}
            onChange={(event) => updateNote(note.id, { issueId: event.target.value || null })}
          >
            <option value="">No linked issue</option>
            {data.issues.map((issue) => (
              <option key={issue.id} value={issue.id}>
                {issueKey(issue.number)} {issue.title}
              </option>
            ))}
          </select>
          {note.tags.map((tag) => (
            <button
              key={tag}
              className="rounded-full bg-primary/15 px-2 py-1 text-primary"
              onClick={() => updateNote(note.id, { tags: note.tags.filter((item) => item !== tag) })}
            >
              #{tag}
            </button>
          ))}
          <form
            onSubmit={(event) => {
              event.preventDefault()
              const tag = tagDraft.trim().replace(/^#/, "")
              if (!tag || note.tags.includes(tag)) return
              updateNote(note.id, { tags: [...note.tags, tag] })
              setTagDraft("")
            }}
          >
            <Input
              value={tagDraft}
              onChange={(event) => setTagDraft(event.target.value)}
              placeholder="Add tag"
              className="h-7 w-28 rounded-full text-xs"
            />
          </form>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const blob = new Blob([toMarkdown({ ...note, title, blocks })], { type: "text/markdown" })
              const url = URL.createObjectURL(blob)
              const link = document.createElement("a")
              link.href = url
              link.download = `${title || "note"}.md`
              link.click()
              URL.revokeObjectURL(url)
            }}
          >
            Export
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              deleteNote(note.id)
              onDeleted()
              toast("Page deleted")
            }}
          >
            <Trash2 /> Delete
          </Button>
        </div>

        {subpages.length > 0 ? (
          <div className="mb-4 flex flex-wrap gap-2">
            {subpages.map((child) => (
              <button key={child.id} className="rounded-lg border px-2.5 py-1.5 text-sm hover:bg-muted" onClick={() => onOpenNote(child.id)}>
                {child.icon} {child.title}
              </button>
            ))}
          </div>
        ) : null}

        <div className="relative space-y-1">
          {rowsFor(blocks).map(({ block, number }) => {
            return (
              <div key={block.id} className="relative">
              <BlockRow
                block={block}
                number={number}
                notes={data.notes}
                issues={data.issues}
                onOpenNote={onOpenNote}
                onOpenIssue={onOpenIssue}
                onFocus={() => setFocusId(block.id)}
                onChange={(text) => updateBlock(block.id, { text })}
                onToggleCheck={() => updateBlock(block.id, { checked: !block.checked }, true)}
                onToggleCollapse={() => updateBlock(block.id, { collapsed: !block.collapsed }, true)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey && block.type !== "code") {
                    event.preventDefault()
                    const continueList = block.type === "bullet" || block.type === "number" || block.type === "todo"
                    if (continueList && !block.text.trim()) {
                      updateBlock(block.id, { type: "paragraph" }, true)
                      return
                    }
                    insertAfter(block.id, continueList ? block.type : "paragraph")
                  }
                  if (event.key === "Backspace" && block.text === "" && block.type !== "divider") {
                    event.preventDefault()
                    removeBlock(block.id)
                  }
                  if (event.key === "Escape") setFocusId(null)
                }}
              />
              {active?.id === block.id && slashQuery !== null ? (
                <CommandMenu
                  query={slashQuery}
                  onPick={(type) => updateBlock(block.id, { type, text: "" }, true)}
                  onPage={() => {
                    const id = createNote({ title: "Untitled", parentId: note.id, icon: "📝" })
                    updateBlock(block.id, { text: block.text.replace(/^\/\S*/, "[[Untitled]]") }, true)
                    onOpenNote(id)
                  }}
                  onToday={() => {
                    const id = ensureDailyNote()
                    const daily = data.notes.find((item) => item.id === id)
                    updateBlock(block.id, { text: `[[${daily?.title ?? "Today"}]] ` }, true)
                    onOpenNote(id)
                  }}
                />
              ) : null}
              {active?.id === block.id && linkQuery !== null ? (
                <LinkMenu
                  query={linkQuery}
                  notes={data.notes}
                  issues={data.issues}
                  onPick={(label) => updateBlock(block.id, { text: block.text.replace(/\[\[[^\]]*$/, `[[${label}]] `) }, true)}
                />
              ) : null}
            </div>
            )
          })}
        </div>

        <button className="mt-4 text-left text-sm text-muted-foreground hover:text-foreground" onClick={() => insertAfter(blocks[blocks.length - 1]?.id ?? "", "paragraph")}>
          Type / for blocks, or [[ to link a page or issue.
        </button>

        <section className="mt-10 grid gap-4 border-t pt-4 md:grid-cols-2">
          <div>
            <h3 className="text-xs tracking-wide text-muted-foreground uppercase">Linked from here</h3>
            <LinkList labels={linksOut} notes={data.notes} issues={data.issues} onOpenNote={onOpenNote} onOpenIssue={onOpenIssue} />
          </div>
          <div>
            <h3 className="text-xs tracking-wide text-muted-foreground uppercase">Backlinks</h3>
            {linksIn.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No other page mentions [[{note.title}]].</p>
            ) : (
              <ul className="mt-2 space-y-1">
                {linksIn.map((item) => (
                  <li key={item.id}>
                    <button className="text-sm hover:underline" onClick={() => onOpenNote(item.id)}>
                      {item.icon} {item.title}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

function BlockRow({
  block,
  number,
  notes,
  issues,
  onFocus,
  onChange,
  onToggleCheck,
  onToggleCollapse,
  onKeyDown,
  onOpenNote,
  onOpenIssue,
}: {
  block: Block
  number: number
  notes: Note[]
  issues: { id: string; number: number; title: string }[]
  onFocus: () => void
  onChange: (text: string) => void
  onToggleCheck: () => void
  onToggleCollapse: () => void
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onOpenNote: (id: string) => void
  onOpenIssue: (id: string) => void
}) {
  if (block.type === "divider") {
    return <hr className="my-3 border-border" />
  }
  const textClass =
    block.type === "h1"
      ? "text-2xl font-medium"
      : block.type === "h2"
        ? "text-xl font-medium"
        : block.type === "h3"
          ? "text-lg font-medium"
          : block.type === "quote"
            ? "border-l-2 border-muted-foreground/40 pl-3 italic text-muted-foreground"
            : block.type === "callout"
              ? "rounded-lg bg-amber-300/10 px-3 py-2 text-amber-50"
              : block.type === "code"
                ? "rounded-lg bg-muted px-3 py-2 font-mono text-sm"
                : "text-sm leading-6"

  return (
    <div className="group flex items-start gap-2">
      {block.type === "todo" ? (
        <button className="mt-1.5" aria-label={block.checked ? "Mark not done" : "Mark done"} onClick={onToggleCheck}>
          <Check className={`size-4 ${block.checked ? "text-emerald-300" : "text-muted-foreground"}`} />
        </button>
      ) : null}
      {block.type === "bullet" ? <span className="mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground" /> : null}
      {block.type === "number" ? <span className="mt-0.5 w-5 shrink-0 text-sm text-muted-foreground">{number}.</span> : null}
      {block.type === "toggle" ? (
        <button className="mt-1" aria-label={block.collapsed ? "Expand" : "Collapse"} onClick={onToggleCollapse}>
          <ChevronRight className={`size-4 text-muted-foreground transition ${block.collapsed ? "" : "rotate-90"}`} />
        </button>
      ) : null}
      <div className="min-w-0 flex-1" onClick={onFocus}>
        <textarea
          id={`block-${block.id}`}
          value={block.text}
          rows={Math.max(1, block.text.split("\n").length)}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder(block.type)}
          className={`w-full resize-none bg-transparent outline-none placeholder:text-muted-foreground/50 ${textClass} ${block.checked ? "text-muted-foreground line-through" : ""}`}
        />
        <RichHints text={block.text} notes={notes} issues={issues} onOpenNote={onOpenNote} onOpenIssue={onOpenIssue} />
      </div>
    </div>
  )
}

function RichHints({
  text,
  notes,
  issues,
  onOpenNote,
  onOpenIssue,
}: {
  text: string
  notes: Note[]
  issues: { id: string; number: number; title: string }[]
  onOpenNote: (id: string) => void
  onOpenIssue: (id: string) => void
}) {
  const labels = linkedTitles(text)
  if (labels.length === 0) return null
  return (
    <div className="mb-1 flex flex-wrap gap-1">
      {labels.map((label) => {
        const match = resolveLink(label, notes, issues)
        if (!match) return <span key={label} className="text-xs text-rose-300">Missing [[{label}]]</span>
        if (match.kind === "note") {
          return (
            <button key={label} className="rounded bg-primary/15 px-1.5 py-0.5 text-xs text-primary" onClick={() => onOpenNote(match.note.id)}>
              {match.note.icon} {match.note.title}
            </button>
          )
        }
        return (
          <button key={label} className="rounded bg-sky-300/15 px-1.5 py-0.5 text-xs text-sky-200" onClick={() => onOpenIssue(match.issue.id)}>
            {issueKey(match.issue.number)}
          </button>
        )
      })}
    </div>
  )
}

function CommandMenu({
  query,
  onPick,
  onPage,
  onToday,
}: {
  query: string
  onPick: (type: BlockType) => void
  onPage: () => void
  onToday: () => void
}) {
  const commands = BLOCK_COMMANDS.filter((command) => command.label.toLowerCase().includes(query) || command.type.includes(query))
  const extras = [
    { id: "page", label: "New subpage", show: "new subpage".includes(query) || "page".includes(query) },
    { id: "today", label: "Today's note", show: "today".includes(query) || "daily".includes(query) },
  ].filter((item) => item.show || query === "")
  if (commands.length === 0 && extras.length === 0) return null
  return (
    <div className="absolute z-20 mt-1 w-64 overflow-hidden rounded-lg border bg-popover shadow-lg">
      {commands.map((command) => (
        <button key={command.type} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted" onMouseDown={(event) => { event.preventDefault(); onPick(command.type) }}>
          <span>{command.label}</span>
          <span className="text-xs text-muted-foreground">{command.hint}</span>
        </button>
      ))}
      {extras.map((extra) => (
        <button
          key={extra.id}
          className="flex w-full px-3 py-2 text-left text-sm hover:bg-muted"
          onMouseDown={(event) => {
            event.preventDefault()
            if (extra.id === "page") onPage()
            else onToday()
          }}
        >
          {extra.label}
        </button>
      ))}
    </div>
  )
}

function LinkMenu({
  query,
  notes,
  issues,
  onPick,
}: {
  query: string
  notes: Note[]
  issues: { id: string; number: number; title: string }[]
  onPick: (label: string) => void
}) {
  const needle = query.toLowerCase()
  const pages = notes.filter((note) => note.title.toLowerCase().includes(needle)).slice(0, 6)
  const tickets = issues.filter((issue) => `${issueKey(issue.number)} ${issue.title}`.toLowerCase().includes(needle)).slice(0, 4)
  if (pages.length === 0 && tickets.length === 0) return null
  return (
    <div className="absolute z-20 w-72 overflow-hidden rounded-lg border bg-popover shadow-lg">
      {pages.map((note) => (
        <button key={note.id} className="flex w-full px-3 py-2 text-left text-sm hover:bg-muted" onMouseDown={(event) => { event.preventDefault(); onPick(note.title) }}>
          {note.icon} {note.title}
        </button>
      ))}
      {tickets.map((issue) => (
        <button key={issue.id} className="flex w-full px-3 py-2 text-left text-sm hover:bg-muted" onMouseDown={(event) => { event.preventDefault(); onPick(issueKey(issue.number)) }}>
          {issueKey(issue.number)} {issue.title}
        </button>
      ))}
    </div>
  )
}

function LinkList({
  labels,
  notes,
  issues,
  onOpenNote,
  onOpenIssue,
}: {
  labels: string[]
  notes: Note[]
  issues: { id: string; number: number; title: string }[]
  onOpenNote: (id: string) => void
  onOpenIssue: (id: string) => void
}) {
  if (labels.length === 0) return <p className="mt-2 text-sm text-muted-foreground">Type [[ to mention a page or an issue.</p>
  return (
    <ul className="mt-2 space-y-1">
      {labels.map((label) => {
        const match = resolveLink(label, notes, issues)
        return (
          <li key={label}>
            {match?.kind === "note" ? (
              <button className="text-sm hover:underline" onClick={() => onOpenNote(match.note.id)}>{match.note.icon} {match.note.title}</button>
            ) : match?.kind === "issue" ? (
              <button className="text-sm hover:underline" onClick={() => onOpenIssue(match.issue.id)}>{issueKey(match.issue.number)} {match.issue.title}</button>
            ) : (
              <span className="text-sm text-rose-300">[[{label}]]</span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function breadcrumb(notes: Note[], note: Note) {
  const chain: Note[] = []
  let current: Note | undefined = note
  while (current) {
    chain.unshift(current)
    current = notes.find((item) => item.id === current?.parentId)
  }
  return chain
}

function trailingLink(text: string) {
  const match = text.match(/\[\[([^\]]*)$/)
  return match ? match[1] : null
}

function rowsFor(blocks: Block[]) {
  const rows: { block: Block; number: number }[] = []
  let hiding = false
  let number = 0
  for (const block of blocks) {
    if (hiding) {
      if (block.type === "h1" || block.type === "h2" || block.type === "h3" || block.type === "toggle") hiding = false
      else continue
    }
    if (block.type === "number") number += 1
    else number = 0
    rows.push({ block, number })
    if (block.type === "toggle" && block.collapsed) hiding = true
  }
  return rows
}

function placeholder(type: BlockType) {
  if (type === "h1" || type === "h2" || type === "h3") return "Heading"
  if (type === "todo") return "To-do"
  if (type === "code") return "Code"
  if (type === "bullet" || type === "number") return "List item"
  if (type === "toggle") return "Toggle"
  return "Write, or type /"
}
