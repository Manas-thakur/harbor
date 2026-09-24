import type { Issue, Note, StoreData, TimeEntry } from "@/lib/types"
import { dayKey } from "@/lib/format"

function at(daysAgo: number, hour: number, minute: number) {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  date.setHours(hour, minute, 0, 0)
  return date.getTime()
}

function span(daysAgo: number, startHour: number, startMinute: number, minutes: number, issueId: string, note: string): TimeEntry {
  const startedAt = at(daysAgo, startHour, startMinute)
  return {
    id: `ent-${issueId}-${daysAgo}-${startHour}${startMinute}`,
    issueId,
    startedAt,
    endedAt: startedAt + minutes * 60_000,
    note,
  }
}

export function createSample(): StoreData {
  const issues: Issue[] = [
    {
      id: "iss-1",
      number: 1,
      title: "Refresh sends you back to the login screen",
      description: "Hard refresh on the dashboard drops the session. It only happens after the tab has been idle.",
      type: "bug",
      status: "in_progress",
      priority: "high",
      cause: "Session token only lives in memory",
      createdAt: at(6, 9, 12),
      updatedAt: at(0, 10, 5),
      completedAt: null,
    },
    {
      id: "iss-2",
      number: 2,
      title: "Login page flashes blank before the redirect",
      description: "First paint is an empty shell, then the redirect. Easy to miss, but it looks broken.",
      type: "bug",
      status: "todo",
      priority: "medium",
      cause: "Session token only lives in memory",
      createdAt: at(5, 14, 40),
      updatedAt: at(1, 16, 10),
      completedAt: null,
    },
    {
      id: "iss-3",
      number: 3,
      title: "Double-click on Pay creates two charges",
      description: "The button stays enabled while the request is in flight. A second click posts again.",
      type: "bug",
      status: "todo",
      priority: "urgent",
      cause: "Missing idempotency key",
      createdAt: at(3, 11, 2),
      updatedAt: at(0, 9, 15),
      completedAt: null,
    },
    {
      id: "iss-4",
      number: 4,
      title: "Search skips archived projects",
      description: "Typing a name that only exists on an archived project returns nothing.",
      type: "bug",
      status: "backlog",
      priority: "medium",
      cause: "Default query excludes archived rows",
      createdAt: at(4, 15, 20),
      updatedAt: at(2, 11, 0),
      completedAt: null,
    },
    {
      id: "iss-5",
      number: 5,
      title: "Timer keeps counting through laptop sleep",
      description: "Close the lid for an hour and the timer adds the whole gap.",
      type: "bug",
      status: "done",
      priority: "high",
      cause: "No pause when the tab is hidden",
      createdAt: at(8, 10, 0),
      updatedAt: at(2, 18, 30),
      completedAt: at(2, 18, 30),
    },
    {
      id: "iss-6",
      number: 6,
      title: "Saved list flashes empty on first paint",
      description: "The empty state shows for a frame before local data arrives.",
      type: "bug",
      status: "done",
      priority: "low",
      cause: "Render before storage has loaded",
      createdAt: at(7, 13, 10),
      updatedAt: at(4, 17, 45),
      completedAt: at(4, 17, 45),
    },
    {
      id: "iss-7",
      number: 7,
      title: "Filter choice is forgotten after a reload",
      description: "Coming back the next morning always opens the full list, even if you were looking at bugs.",
      type: "bug",
      status: "backlog",
      priority: "low",
      cause: "",
      createdAt: at(1, 9, 40),
      updatedAt: at(1, 9, 40),
      completedAt: null,
    },
    {
      id: "iss-8",
      number: 8,
      title: "Write the Friday notes template",
      description: "A short note: what shipped, what is stuck, and what the next morning starts with.",
      type: "task",
      status: "todo",
      priority: "medium",
      cause: "",
      createdAt: at(2, 8, 30),
      updatedAt: at(0, 8, 10),
      completedAt: null,
    },
    {
      id: "iss-9",
      number: 9,
      title: "Rename staging env vars before the deploy",
      description: "The new names are in the doc. Staging still uses the old ones.",
      type: "task",
      status: "in_progress",
      priority: "high",
      cause: "",
      createdAt: at(1, 11, 15),
      updatedAt: at(0, 11, 40),
      completedAt: null,
    },
    {
      id: "iss-10",
      number: 10,
      title: "Start a timer from the keyboard",
      description: "Press T on the selected issue and the clock starts. Press T again to stop.",
      type: "improvement",
      status: "backlog",
      priority: "low",
      cause: "",
      createdAt: at(3, 16, 5),
      updatedAt: at(3, 16, 5),
      completedAt: null,
    },
  ]

  const entries: TimeEntry[] = [
    span(0, 9, 10, 50, "iss-1", "Traced the refresh path"),
    span(0, 10, 15, 35, "iss-9", "Compared staging names"),
    span(1, 9, 30, 80, "iss-3", "Reproduced the double charge"),
    span(1, 14, 0, 45, "iss-2", "Watched the first paint"),
    span(1, 16, 20, 40, "iss-8", "Sketched the Friday note"),
    span(2, 11, 0, 70, "iss-5", "Paused the clock on hide"),
    span(2, 15, 10, 55, "iss-4", "Checked the search query"),
    span(3, 10, 5, 90, "iss-1", "Moved the token into storage"),
    span(3, 14, 40, 30, "iss-9", "Listed the old names"),
    span(4, 13, 0, 60, "iss-6", "Held the empty state until hydrate"),
    span(5, 9, 45, 40, "iss-3", "Read the payment handler"),
    span(6, 11, 20, 50, "iss-2", "Logged the blank frame"),
  ]

  return { issues, entries, notes: sampleNotes(), nextNumber: 11 }
}

function block(id: string, type: Note["blocks"][number]["type"], text: string, checked = false): Note["blocks"][number] {
  return { id, type, text, checked, collapsed: false }
}

export function sampleNotes(): Note[] {
  const today = dayKey(Date.now())
  return [
    {
      id: "note-home",
      title: "Working notes",
      icon: "🧭",
      parentId: null,
      tags: ["harbor"],
      pinned: true,
      issueId: null,
      dailyDate: null,
      sort: 0,
      createdAt: at(6, 9, 0),
      updatedAt: at(0, 9, 0),
      blocks: [
        block("b1", "paragraph", "A place for the thinking that does not fit on a ticket. Link a page to an issue, or mention it with [[HBR-1]]."),
        block("b2", "h2", "Open threads"),
        block("b3", "bullet", "Session drops are written up in [[Session token]]."),
        block("b4", "bullet", "Today's page is [[Today]]."),
        block("b5", "callout", "Pages nest. Backlinks update when you rename a page."),
      ],
    },
    {
      id: "note-token",
      title: "Session token",
      icon: "🐛",
      parentId: "note-home",
      tags: ["auth", "bug"],
      pinned: false,
      issueId: "iss-1",
      dailyDate: null,
      sort: 0,
      createdAt: at(5, 11, 0),
      updatedAt: at(0, 10, 20),
      blocks: [
        block("b6", "paragraph", "Tied to [[HBR-1]] and the blank login flash on [[HBR-2]]."),
        block("b7", "h2", "What I saw"),
        block("b8", "paragraph", "A hard refresh drops the session after the tab has been idle. The first paint is empty, then the redirect."),
        block("b9", "h2", "Cause"),
        block("b10", "paragraph", "The token only lives in memory, so a reload has nothing to restore."),
        block("b11", "h2", "What I tried"),
        block("b12", "todo", "Keep the token somewhere that survives refresh", true),
        block("b13", "todo", "Stop the blank frame before the session is known"),
        block("b14", "code", "session = memory.get('token') // gone after reload"),
      ],
    },
    {
      id: "note-today",
      title: "Today",
      icon: "🗓️",
      parentId: null,
      tags: ["daily"],
      pinned: false,
      issueId: null,
      dailyDate: today,
      sort: 1,
      createdAt: at(0, 8, 30),
      updatedAt: at(0, 11, 0),
      blocks: [
        block("b15", "h2", "Plan"),
        block("b16", "todo", "Finish the session-token writeup in [[Session token]]"),
        block("b17", "todo", "Rename staging env vars"),
        block("b18", "h2", "Notes"),
        block("b19", "paragraph", "The double charge is still open. Cause is already on the ticket: missing idempotency key."),
        block("b20", "quote", "Write the cause when you find it, not at the end of the week."),
      ],
    },
  ]
}
