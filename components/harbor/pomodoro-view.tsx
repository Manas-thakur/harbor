"use client"

import { useEffect, useRef, useState } from "react"
import { Pause, Play, RotateCcw, SkipForward } from "lucide-react"
import { Button } from "@/components/ui/button"
import { dayKey, formatDuration } from "@/lib/format"
import { useStore } from "@/lib/store"
import { issueKey, phaseLength, type PomodoroPhase } from "@/lib/types"

const PHASE_LABEL: Record<PomodoroPhase, string> = {
  focus: "Focus",
  short: "Short break",
  long: "Long break",
}

export function PomodoroView() {
  const { data, startPomodoro, pausePomodoro, resetPomodoro, skipPomodoro, completePomodoro, setPomodoro } = useStore()
  const pomo = data.pomodoro
  const [now, setNow] = useState(() => Date.now())
  const completeRef = useRef(completePomodoro)
  const seenLog = useRef(pomo.logs[0]?.id ?? null)

  useEffect(() => {
    completeRef.current = completePomodoro
    if (!pomo.running || !pomo.endsAt) return
    const endsAt = pomo.endsAt
    const id = window.setInterval(() => {
      const time = Date.now()
      setNow(time)
      if (time >= endsAt) completeRef.current()
    }, 250)
    return () => window.clearInterval(id)
  }, [pomo.running, pomo.endsAt, completePomodoro])

  useEffect(() => {
    const id = pomo.logs[0]?.id ?? null
    if (seenLog.current && id && seenLog.current !== id) chime()
    seenLog.current = id
  }, [pomo.logs])

  const remaining = pomo.running && pomo.endsAt ? Math.max(0, pomo.endsAt - now) : pomo.remainingMs
  const total = phaseLength(pomo)
  const progress = total === 0 ? 0 : 1 - remaining / total
  const today = pomo.logs.filter((log) => log.phase === "focus" && dayKey(log.endedAt) === dayKey(now))
  const todayMs = today.reduce((sum, log) => sum + (log.endedAt - log.startedAt), 0)
  const issue = data.issues.find((item) => item.id === pomo.issueId) ?? null

  return (
    <div className="harbor-scroll flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-4 py-8">
      <div className="flex w-full max-w-lg flex-col items-center">
        <p className="text-xs tracking-wide text-muted-foreground uppercase">{PHASE_LABEL[pomo.phase]}</p>
        <Ring progress={progress} label={formatClock(remaining)} />
        <div className="mt-2 flex gap-1.5">
          {Array.from({ length: pomo.settings.cycle }, (_, index) => (
            <span
              key={index}
              className={`size-2 rounded-full ${index < pomo.completedInCycle ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          {today.length} focus {today.length === 1 ? "session" : "sessions"} today · {formatDuration(todayMs)}
        </p>

        <label className="mt-6 grid w-full gap-1 text-xs text-muted-foreground">
          Work this session on
          <select
            className="h-9 rounded-lg border border-input bg-input/30 px-2 text-sm text-foreground"
            value={pomo.issueId ?? ""}
            onChange={(event) => setPomodoro({ issueId: event.target.value || null })}
          >
            <option value="">No issue</option>
            {data.issues.filter((item) => item.status !== "done").map((item) => (
              <option key={item.id} value={item.id}>
                {issueKey(item.number)} {item.title}
              </option>
            ))}
          </select>
        </label>
        {issue ? <p className="mt-2 text-xs text-muted-foreground">Focus time is added to {issueKey(issue.number)}.</p> : null}

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {pomo.running ? (
            <Button onClick={() => pausePomodoro()}><Pause /> Pause</Button>
          ) : (
            <Button onClick={() => startPomodoro()}><Play /> {remaining < total ? "Resume" : "Start"}</Button>
          )}
          <Button variant="outline" onClick={() => skipPomodoro()}><SkipForward /> Skip</Button>
          <Button variant="ghost" onClick={() => resetPomodoro()}><RotateCcw /> Reset</Button>
        </div>

        <div className="mt-8 grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
          <Stepper label="Focus" value={pomo.settings.focusMinutes} min={1} max={90} suffix="m" onChange={(focusMinutes) => setPomodoro({ settings: { focusMinutes } })} />
          <Stepper label="Short" value={pomo.settings.shortMinutes} min={1} max={30} suffix="m" onChange={(shortMinutes) => setPomodoro({ settings: { shortMinutes } })} />
          <Stepper label="Long" value={pomo.settings.longMinutes} min={1} max={60} suffix="m" onChange={(longMinutes) => setPomodoro({ settings: { longMinutes } })} />
          <Stepper label="Until long" value={pomo.settings.cycle} min={2} max={8} onChange={(cycle) => setPomodoro({ settings: { cycle } })} />
        </div>
        {pomo.running ? <p className="mt-3 text-xs text-muted-foreground">Length changes apply after this session.</p> : null}

        <section className="mt-8 w-full">
          <h2 className="text-xs tracking-wide text-muted-foreground uppercase">Recent sessions</h2>
          {pomo.logs.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Finished focus blocks show up here and on the Time page when an issue is selected.</p>
          ) : (
            <ul className="mt-2 divide-y divide-border overflow-hidden rounded-xl border">
              {pomo.logs.slice(0, 8).map((log) => {
                const linked = data.issues.find((item) => item.id === log.issueId)
                return (
                  <li key={log.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                    <span>{PHASE_LABEL[log.phase]}{linked ? ` · ${issueKey(linked.number)}` : ""}</span>
                    <span className="font-mono text-xs text-muted-foreground">{formatDuration(log.endedAt - log.startedAt)}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

function Ring({ progress, label }: { progress: number; label: string }) {
  const radius = 88
  const circ = 2 * Math.PI * radius
  const offset = circ * (1 - Math.min(1, Math.max(0, progress)))
  return (
    <div className="relative mt-4 grid size-64 place-items-center">
      <svg className="absolute size-full -rotate-90" viewBox="0 0 200 200" aria-hidden>
        <circle cx="100" cy="100" r={radius} className="fill-none stroke-muted" strokeWidth="8" />
        <circle
          cx="100"
          cy="100"
          r={radius}
          className="fill-none stroke-primary"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
        />
      </svg>
      <p className="font-mono text-5xl tracking-tight">{label}</p>
    </div>
  )
}

function Stepper({
  label,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  suffix?: string
  onChange: (value: number) => void
}) {
  return (
    <div className="rounded-xl border px-2 py-2 text-center">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-center justify-center gap-2">
        <button className="size-6 rounded-md bg-muted text-sm" onClick={() => onChange(Math.max(min, value - 1))} aria-label={`Decrease ${label}`}>−</button>
        <span className="min-w-8 font-mono text-sm">{value}{suffix}</span>
        <button className="size-6 rounded-md bg-muted text-sm" onClick={() => onChange(Math.min(max, value + 1))} aria-label={`Increase ${label}`}>+</button>
      </div>
    </div>
  )
}

function formatClock(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}

function chime() {
  const audio = new AudioContext()
  const oscillator = audio.createOscillator()
  const gain = audio.createGain()
  oscillator.frequency.value = 660
  gain.gain.value = 0.04
  oscillator.connect(gain)
  gain.connect(audio.destination)
  oscillator.start()
  oscillator.stop(audio.currentTime + 0.18)
  oscillator.onended = () => void audio.close()
}
