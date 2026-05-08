import Dexie, { type Table } from 'dexie'

/**
 * Local offline store backed by Dexie (IndexedDB).
 *
 * Stores:
 *   - encounters: snapshot of each encounter the user has opened, keyed by `id`.
 *   - labOrders: per-encounter lab-order state, keyed by `encounter_id`.
 *   - pendingActions: FIFO queue of mutations made while offline. Retry
 *     metadata (attemptCount, nextAttemptAt) lets the SyncEngine apply
 *     exponential backoff without re-hammering the network.
 *
 * Schema versioning lives here — bump `version(N).stores({...})` with an
 * `.upgrade(tx => ...)` callback on every store-shape change. Dexie
 * preserves data across versions, unlike our previous raw-IDB implementation
 * which would silently lose drafts on any schema drift.
 */

export interface CachedEncounter extends Record<string, unknown> {
  id: string
}

export interface CachedLabOrder extends Record<string, unknown> {
  encounter_id: string
}

export type PendingActionType =
  | 'update-encounter'
  | 'update-lab-order-item'
  | 'add-lab-order-item'
  | 'remove-lab-order-item'

export interface PendingAction {
  id?: number
  type: PendingActionType
  url: string
  method: 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  createdAt: number
  /** Number of failed attempts so far. Incremented on every 5xx/network error. */
  attemptCount?: number
  /** Earliest wall-clock ms at which the SyncEngine may retry this action. */
  nextAttemptAt?: number
  /** Last captured error for diagnostics. Not used by retry logic. */
  lastError?: string
  /** API response body for failed offline mutation recovery. */
  lastErrorDetails?: unknown
}

export interface FailedAction extends Omit<PendingAction, 'id'> {
  id?: number
  originalActionId?: number
  failedAt: number
  status: number
  reason: string
  details?: unknown
}

class AppDatabase extends Dexie {
  encounters!: Table<CachedEncounter, string>
  labOrders!: Table<CachedLabOrder, string>
  pendingActions!: Table<PendingAction, number>
  failedActions!: Table<FailedAction, number>

  constructor() {
    super('clinicapp-offline')

    // v1 — initial Dexie schema. Shape matches the preceding raw-IDB stores
    // so cached data read on first load maps cleanly.
    this.version(1).stores({
      encounters: 'id',
      labOrders: 'encounter_id',
      pendingActions: '++id, createdAt, type',
    })

    // v2 — add retry-metadata indexes for the SyncEngine. Existing rows
    // are untouched; missing fields resolve to `undefined` and the engine
    // treats them as attemptCount=0, nextAttemptAt=0 (eligible immediately).
    this.version(2).stores({
      encounters: 'id',
      labOrders: 'encounter_id',
      pendingActions: '++id, createdAt, type, nextAttemptAt',
    })

    // v3 — retain permanently rejected offline mutations for user recovery
    // instead of silently deleting clinical edits that the API rejected.
    this.version(3).stores({
      encounters: 'id',
      labOrders: 'encounter_id',
      pendingActions: '++id, createdAt, type, nextAttemptAt',
      failedActions: '++id, failedAt, type, status',
    })
  }
}

export const db = new AppDatabase()

// Some users carry a stale IndexedDB from the pre-Dexie raw-IDB era (or an
// older Dexie shape) whose primary keys don't match what we declare above.
// Dexie can't upgrade across primary-key changes, so it throws
// `UpgradeError: Not yet support for changing primary key` on first open.
// Recover by wiping the local DB and re-opening — this only loses cached
// reads + the FIFO of pending actions, both of which the SyncEngine will
// re-fetch on the next tick.
db.open().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  if (!/changing primary key|UpgradeError/i.test(message)) {
    return
  }
  db.close()
  void Dexie.delete('clinicapp-offline').then(() => db.open())
})
