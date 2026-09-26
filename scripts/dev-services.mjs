import { spawn } from "node:child_process"
import path from "node:path"
import { ports } from "../services/lib/defaults.mjs"

const root = process.cwd()
const files = [
  "services/auth/server.mjs",
  "services/teams/server.mjs",
  "services/issues/server.mjs",
  "services/time/server.mjs",
  "services/notes/server.mjs",
  "services/pomodoro/server.mjs",
  "services/gateway/server.mjs",
]

await new Promise((resolve, reject) => {
  const migrate = spawn(process.execPath, ["services/migrate.mjs"], { cwd: root, stdio: "inherit" })
  migrate.on("exit", (code) => (code === 0 ? resolve() : reject(new Error("migrate failed"))))
})

const children = files.map((file) =>
  spawn(process.execPath, [file], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  })
)

async function ready() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${ports.gateway}/health`)
      if (response.ok) return
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 150))
    }
  }
  throw new Error("Harbor services did not become ready")
}

await ready()
console.log("Harbor services are ready.")

function shutdown() {
  for (const child of children) child.kill("SIGTERM")
  process.exit(0)
}
process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)
await new Promise(() => {})
