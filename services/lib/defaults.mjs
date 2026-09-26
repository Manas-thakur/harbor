export function defaultPomodoro() {
  return {
    settings: { focusMinutes: 25, shortMinutes: 5, longMinutes: 15, cycle: 4 },
    phase: "focus",
    issueId: null,
    running: false,
    endsAt: null,
    remainingMs: 25 * 60_000,
    completedInCycle: 0,
    logs: [],
  }
}

export const ports = {
  gateway: 4100,
  auth: 4101,
  teams: 4102,
  issues: 4103,
  time: 4104,
  notes: 4105,
  pomodoro: 4106,
}
