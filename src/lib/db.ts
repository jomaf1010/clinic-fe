import Dexie, { type Table } from 'dexie'

/**
 * Local offline store backed by Dexie (IndexedDB).
 *
 * Stores:
 *   - encounters: snapshot of each encounter the user has opened, keyed by `id`.
 *   - labOrders: per-encounter lab-order state, keyed by `encounter_id`.
 *   - pendingActions: FIFO queue of mutations made while offline, auto-incrementing id.
 *
 * Schema versioning lives in this file — bump `version(N).stores({...})` with
 * an `.upgrade(tx => ...)` callback whenever a store shape changes. Dexie
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
}

class AppDatabase extends Dexie {
  encounters!: Table<CachedEncounter, string>
  labOrders!: Table<CachedLabOrder, string>
  pendingActions!: Table<PendingAction, number>

  constructor() {
    super('clinicapp-offline')

    // v1 — initial Dexie schema. Shape matches the preceding raw-IDB stores
    // so existing cached data remains readable after upgrade.
    this.version(1).stores({
      encounters: 'id',
      labOrders: 'encounter_id',
      pendingActions: '++id, createdAt, type',
    })
  }
}

export const db = new AppDatabase()
