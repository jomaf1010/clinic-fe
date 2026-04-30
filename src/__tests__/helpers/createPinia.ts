/**
 * Pinia helpers for tests.
 *
 * The setup file already activates a fresh Pinia in beforeEach. These
 * helpers are for tests that need finer control: re-activate a fresh
 * instance mid-test, or stub a store with hand-rolled state.
 */

import { setActivePinia, createPinia, type Store } from 'pinia'

/**
 * Activate and return a fresh Pinia instance. Use when a test needs a
 * second Pinia (e.g., re-mount with cleared state) — for the default
 * one Pinia per test, the global setup handles it.
 */
export function setupTestPinia() {
  const pinia = createPinia()
  setActivePinia(pinia)
  return pinia
}

/**
 * Replace selected fields/actions on a real store with vi.fn() spies.
 * The original store stays callable for fields not in `overrides` —
 * useful when a downstream consumer reads `someStore.someField` but
 * the test only cares about one action or one piece of state.
 *
 * Example:
 *   const auth = useAuthStore()
 *   stubStore(auth, {
 *     hasPermission: vi.fn(() => true),
 *     currentClinic: { id: 'c1', uuid: 'c1' },
 *   })
 */
export function stubStore<S extends Store>(store: S, overrides: Partial<S>): S {
  for (const key of Object.keys(overrides) as (keyof S)[]) {
    const value = overrides[key]
    if (value !== undefined) {
      // Pinia state + actions are reactive — direct assignment works for
      // both. For getters, use vi.spyOn separately at the test site.
      ;(store as unknown as Record<string, unknown>)[key as string] = value
    }
  }
  return store
}
