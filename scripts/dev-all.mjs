import { spawn } from "node:child_process"
import { ports } from "../services/lib/defaults.mjs"

const services = spawn(process.execPath, ["scripts/dev-services.mjs"], { stdio: "inherit" })

for (let attempt = 0; attempt < 50; attempt += 1) {
  try {
    const response = await fetch(`http://127.0.0.1:${ports.gateway}/health`)
    if (response.ok) break
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  if (attempt === 49) {
    services.kill("SIGTERM")
    throw new Error("Harbor services did not start")
  }
}

const web = spawn("npx", ["next", "dev", "-p", "3847", "-H", "0.0.0.0"], { stdio: "inherit" })

function shutdown() {
  web.kill("SIGTERM")
  services.kill("SIGTERM")
  process.exit(0)
}
process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)
await new Promise(() => {})
