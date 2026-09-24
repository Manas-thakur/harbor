import type { StoreData } from "@/lib/types"

export function isStoreData(value: unknown): value is StoreData {
  if (!value || typeof value !== "object") return false
  const data = value as StoreData
  return Array.isArray(data.issues) && Array.isArray(data.entries) && typeof data.nextNumber === "number"
}
