import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto"
import { promisify } from "node:util"

const scrypt = promisify(scryptCallback)

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex")
  const derived = (await scrypt(password, salt, 32)) as Buffer
  return `${salt}:${derived.toString("hex")}`
}

export async function verifyPassword(password: string, stored: string) {
  const [salt, hex] = stored.split(":")
  if (!salt || !hex) return false
  const derived = (await scrypt(password, salt, 32)) as Buffer
  const expected = Buffer.from(hex, "hex")
  if (expected.length !== derived.length) return false
  return timingSafeEqual(expected, derived)
}
