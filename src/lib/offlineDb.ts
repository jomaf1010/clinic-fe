import { db, type FailedAction, type PendingAction } from './db'

export type { FailedAction, PendingAction }

// --- Encounters ---

export async function cacheEncounter(data: Record<string, unknown>): Promise<void> {
  // Structured clone via JSON round-trip keeps Dexie from choking on Vue reactivity proxies.
  await db.encounters.put(JSON.parse(JSON.stringify(data)))
}

export async function getCachedEncounter(id: string): Promise<Record<string, unknown> | undefined> {
  return db.encounters.get(id)
}

// --- Lab Orders ---

export async function cacheLabOrder(encounterId: string, data: Record<string, unknown>): Promise<void> {
  const plain = JSON.parse(JSON.stringify({ ...data, encounter_id: encounterId }))
  await db.labOrders.put(plain)
}

export async function getCachedLabOrder(encounterId: string): Promise<Record<string, unknown> | undefined> {
  return db.labOrders.get(encounterId)
}

// --- Pending Actions (offline mutation queue) ---

export async function queueAction(action: PendingAction): Promise<void> {
  // Dexie auto-assigns `id` via the `++id` primary-key spec — strip any
  // caller-supplied id so we never collide with an existing row.
  const { id: _ignored, ...rest } = action
  await db.pendingActions.add(rest as PendingAction)
}

export async function getPendingActions(): Promise<{ key: number; action: PendingAction }[]> {
  const rows = await db.pendingActions.orderBy('id').toArray()
  return rows.map((row) => ({ key: row.id as number, action: row }))
}

export async function removePendingAction(key: number): Promise<void> {
  await db.pendingActions.delete(key)
}

export async function getPendingActionCount(): Promise<number> {
  return db.pendingActions.count()
}

// --- Failed Actions (offline mutation recovery queue) ---

export async function recordFailedAction(action: FailedAction): Promise<number> {
  const { id: _ignored, ...rest } = action
  return db.failedActions.add(rest as FailedAction)
}

export async function getFailedActions(): Promise<FailedAction[]> {
  return db.failedActions.orderBy('failedAt').toArray()
}

export async function getFailedActionCount(): Promise<number> {
  return db.failedActions.count()
}

export async function removeFailedAction(key: number): Promise<void> {
  await db.failedActions.delete(key)
}
