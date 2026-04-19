import type { PendingAction } from '../db'

/**
 * Decision returned by SyncEngine's per-action runner.
 *
 *   - 'succeeded' → remove from queue, continue
 *   - 'retry' → leave in queue with updated retry metadata, continue
 *   - 'abort' → stop processing entirely (network dropped, rate-limited, etc.)
 *   - 'discard' → remove from queue (permanent 4xx), continue with next
 */
export type ActionOutcome = 'succeeded' | 'retry' | 'abort' | 'discard'

export interface SyncEventMap {
  'action-succeeded': { action: PendingAction }
  'action-discarded': { action: PendingAction; reason: string }
  'action-retrying': { action: PendingAction; nextAttemptAt: number }
  'queue-drained': { processed: number }
  'queue-stopped': { reason: 'offline' | 'error' | 'backoff'; processed: number }
  'conflict-detected': { entity: string; id: string; localUpdatedAt: string; remoteUpdatedAt: string }
}

export type SyncEventType = keyof SyncEventMap
export type SyncEventHandler<T extends SyncEventType> = (payload: SyncEventMap[T]) => void

/**
 * Base contract every domain-specific repository implements.
 *
 * Repositories hide the read-through cache + offline queue behind a single
 * API surface the UI layer can use without caring whether the device is
 * online. Consumers always get a valid local value when one exists;
 * reconciliation with the server happens in the background.
 */
export interface Repository<T extends { id: string }> {
  /**
   * Returns the entity from cache immediately if present, then revalidates
   * from the network in the background. When offline and uncached, returns
   * `undefined`.
   */
  get(id: string, opts?: { skipCache?: boolean }): Promise<T | undefined>

  /**
   * Persists a partial update. Always writes to the local cache first so
   * the UI can re-render optimistically. When online, PATCHes the server;
   * when offline, queues a pending action via the SyncEngine.
   */
  save(data: Partial<T> & { id: string }): Promise<T>
}

/**
 * Pluggable conflict detection + resolution contract. Domain repositories
 * instantiate this to describe how local and remote versions of the same
 * entity should be compared.
 *
 * Default behavior (used when a repo doesn't override): last-write-wins
 * based on `updated_at` timestamp.
 */
export interface ConflictPolicy<T> {
  /** Return true when server data is newer than local unsaved changes. */
  detect(local: T, remote: T): boolean
  /** Return the merged entity to persist after a detected conflict. */
  resolve(local: T, remote: T): T
}
