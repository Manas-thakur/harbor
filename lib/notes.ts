import type { Block, BlockType, Issue, Note } from "@/lib/types"
import { issueKey } from "@/lib/types"

export const BLOCK_COMMANDS: { type: BlockType; label: string; hint: string }[] = [
  { type: "paragraph", label: "Text", hint: "Plain paragraph" },
  { type: "h1", label: "Heading 1", hint: "Large section" },
  { type: "h2", label: "Heading 2", hint: "Section" },
  { type: "h3", label: "Heading 3", hint: "Small section" },
  { type: "bullet", label: "Bulleted list", hint: "Simple list" },
  { type: "number", label: "Numbered list", hint: "Ordered list" },
  { type: "todo", label: "To-do", hint: "Check it off" },
  { type: "toggle", label: "Toggle", hint: "Hide the next lines" },
  { type: "quote", label: "Quote", hint: "Something worth keeping" },
  { type: "callout", label: "Callout", hint: "A note in the margin" },
  { type: "code", label: "Code", hint: "Monospace, Enter stays inside" },
  { type: "divider", label: "Divider", hint: "A visual break" },
]

export function makeBlock(type: BlockType = "paragraph", text = ""): Block {
  return { id: crypto.randomUUID(), type, text, checked: false, collapsed: false }
}

export function blankBlocks() {
  return [makeBlock()]
}

export function dailyBlocks(): Block[] {
  return [
    makeBlock("h2", "Plan"),
    makeBlock("todo", ""),
    makeBlock("h2", "Notes"),
    makeBlock("paragraph", ""),
    makeBlock("h2", "Stuck on"),
    makeBlock("paragraph", ""),
  ]
}

export function investigationBlocks(issue?: Issue): Block[] {
  const link = issue ? `[[${issueKey(issue.number)}]]` : ""
  return [
    makeBlock("h2", "What I saw"),
    makeBlock("paragraph", link),
    makeBlock("h2", "Cause"),
    makeBlock("paragraph", issue?.cause ?? ""),
    makeBlock("h2", "What I tried"),
    makeBlock("bullet", ""),
    makeBlock("h2", "Next"),
    makeBlock("todo", ""),
  ]
}

const LINK = /\[\[([^\]]+)\]\]/g

export function notePlainText(note: Note) {
  return [note.title, note.tags.join(" "), ...note.blocks.map((block) => block.text)].join("\n")
}

export function linkedTitles(text: string) {
  return [...text.matchAll(LINK)].map((match) => match[1])
}

export function outgoingTitles(note: Note) {
  const titles = note.blocks.flatMap((block) => linkedTitles(block.text))
  return [...new Set(titles)]
}

export function backlinks(notes: Note[], title: string) {
  const needle = `[[${title}]]`
  return notes.filter((note) => note.title !== title && note.blocks.some((block) => block.text.includes(needle)))
}

export function resolveLink(label: string, notes: Note[], issues: Pick<Issue, "id" | "number" | "title">[]) {
  const note = notes.find((item) => item.title === label)
  if (note) return { kind: "note" as const, note }
  const issue = issues.find((item) => issueKey(item.number) === label || item.title === label)
  if (issue) return { kind: "issue" as const, issue }
  return null
}

export function renameLinks(notes: Note[], from: string, to: string) {
  if (!from || from === to) return notes
  const source = `[[${from}]]`
  const target = `[[${to}]]`
  return notes.map((note) => ({
    ...note,
    blocks: note.blocks.map((block) =>
      block.text.includes(source) ? { ...block, text: block.text.split(source).join(target) } : block
    ),
  }))
}

export function toMarkdown(note: Note) {
  const lines = [`# ${note.icon} ${note.title}`.trim()]
  if (note.tags.length) lines.push("", note.tags.map((tag) => `#${tag}`).join(" "))
  let count = 1
  for (const block of note.blocks) {
    if (block.type === "divider") {
      lines.push("", "---")
      count = 1
      continue
    }
    if (block.type === "number") {
      lines.push(`${count}. ${block.text}`)
      count += 1
      continue
    }
    count = 1
    if (block.type === "h1") lines.push("", `# ${block.text}`)
    else if (block.type === "h2") lines.push("", `## ${block.text}`)
    else if (block.type === "h3") lines.push("", `### ${block.text}`)
    else if (block.type === "bullet") lines.push(`- ${block.text}`)
    else if (block.type === "todo") lines.push(`- [${block.checked ? "x" : " "}] ${block.text}`)
    else if (block.type === "quote" || block.type === "callout") lines.push("", `> ${block.text}`)
    else if (block.type === "code") lines.push("", "```", block.text, "```")
    else if (block.type === "toggle") lines.push("", `<details><summary>${block.text}</summary></details>`)
    else lines.push("", block.text)
  }
  return lines.join("\n").trim() + "\n"
}

export function childrenOf(notes: Note[], parentId: string | null) {
  return notes.filter((note) => note.parentId === parentId).sort((a, b) => a.sort - b.sort || a.createdAt - b.createdAt)
}

export function isDescendant(notes: Note[], id: string, maybeParent: string) {
  let current = notes.find((note) => note.id === maybeParent)
  while (current) {
    if (current.id === id) return true
    current = notes.find((note) => note.id === current?.parentId)
  }
  return false
}
