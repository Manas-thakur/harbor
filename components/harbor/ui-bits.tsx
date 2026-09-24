"use client"

import {
  Ban,
  Bug,
  Circle,
  CircleCheck,
  CircleDashed,
  CircleDot,
  Sparkles,
  SquareCheck,
} from "lucide-react"
import { cn } from "cn"
import type { IssueStatus, IssueType, Priority } from "@/lib/types"
import { PRIORITIES, STATUSES, TYPES } from "@/lib/types"

export function StatusIcon({ status, className }: { status: IssueStatus; className?: string }) {
  const shared = cn("size-4 shrink-0", className)
  if (status === "backlog") return <CircleDashed className={cn(shared, "text-stone-400")} />
  if (status === "todo") return <Circle className={cn(shared, "text-sky-300")} />
  if (status === "in_progress") return <CircleDot className={cn(shared, "text-amber-300")} />
  return <CircleCheck className={cn(shared, "text-emerald-300")} />
}

export function TypeIcon({ type, className }: { type: IssueType; className?: string }) {
  const shared = cn("size-3.5 shrink-0", className)
  if (type === "bug") return <Bug className={cn(shared, "text-rose-300")} />
  if (type === "task") return <SquareCheck className={cn(shared, "text-sky-300")} />
  return <Sparkles className={cn(shared, "text-emerald-300")} />
}

export function PriorityMark({ priority }: { priority: Priority }) {
  const tone =
    priority === "urgent"
      ? "bg-rose-400"
      : priority === "high"
        ? "bg-amber-400"
        : priority === "medium"
          ? "bg-yellow-200"
          : priority === "low"
            ? "bg-sky-300"
            : "bg-stone-600"
  return <span className={cn("inline-block size-1.5 rounded-full", tone)} />
}

const fieldClass =
  "h-8 w-full rounded-lg border border-input bg-input/30 px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"

export function FieldSelect<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T
  onChange: (value: T) => void
  options: { id: T; label: string }[]
  label: string
}) {
  return (
    <label className="grid gap-1 text-xs text-muted-foreground">
      {label}
      <select className={fieldClass} value={value} onChange={(event) => onChange(event.target.value as T)}>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function statusLabel(status: IssueStatus) {
  return STATUSES.find((item) => item.id === status)?.label ?? status
}

export function typeLabel(type: IssueType) {
  return TYPES.find((item) => item.id === type)?.label ?? type
}

export function priorityLabel(priority: Priority) {
  return PRIORITIES.find((item) => item.id === priority)?.label ?? priority
}

export function EmptyHint({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <Ban className="mb-3 size-5 text-muted-foreground" />
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>
    </div>
  )
}
