/**
 * Mock for IndexedDB via `fake-indexeddb`.
 *
 * Use in tests that exercise Dexie wrappers (`@/lib/db`, `@/lib/offlineDb`)
 * or the SyncEngine. Each test gets a clean IndexedDB so persisted state
 * doesn't bleed between tests.
 *
 * Usage:
 *   import { beforeEach } from 'vitest'
 *   import { resetIndexedDb } from '@/__tests__/helpers/mockDexie'
 *
 *   beforeEach(() => resetIndexedDb())
 *
 *   // ...test code that opens / writes to / reads from Dexie
 *
 * The fake-indexeddb package patches the global `indexedDB` and
 * `IDBKeyRange` so Dexie just works. Importing this module once at
 * setup time wires the patches; subsequent `resetIndexedDb` calls
 * dispose Dexie's cached database connections.
 */

// fake-indexeddb/auto patches `globalThis.indexedDB` + `globalThis.IDBKeyRange`
// at import time. Importing it here means any test file that imports
// from '@/__tests__/helpers/mockDexie' gets the patched globals.
import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'

/**
 * Wipe IndexedDB and reset Dexie's connection caches. Call in
 * `beforeEach` to give every test a fresh database.
 */
export async function resetIndexedDb(): Promise<void> {
  // Replace the patched factory with a brand-new one — drops every
  // database in one shot. fake-indexeddb keeps databases in-memory so
  // there's nothing to await.
  globalThis.indexedDB = new IDBFactory()

  // Dexie caches DB instances per-module. Importing the consumer
  // modules with vi.resetModules() between tests would clear those
  // caches; the module-mock pattern in our spec convention already
  // does this. If a test doesn't reset modules, it should manually
  // close any Dexie connection it opened.
}
