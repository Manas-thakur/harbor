import { mkdirSync } from "node:fs"
import path from "node:path"
import { DatabaseSync } from "node:sqlite"

export function openDb(file, schema) {
  const full = path.join(process.cwd(), "data", file)
  mkdirSync(path.dirname(full), { recursive: true })
  const db = new DatabaseSync(full)
  db.exec("PRAGMA journal_mode = WAL;")
  db.exec(schema)
  return db
}
