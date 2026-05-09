import { db, type FailedAction, type PendingAction } from '../db'
import { http, HttpError } from '../http'
import type { ActionOutcome, SyncEventHandler, SyncEventMap, SyncEventType } from './types'

/**
 * Mirrors the iOS `SyncActor` role: a single serialized processor for the
 * pending-mutation queue.
 *
 * Responsibilities:
 *   - Pull the next eligible action from `db.pendingActions` (sorted by id).
 *   - Dispatch it to the HTTP layer.
 *   - Classify the outcome (success / retryable / permanent) and update
 *     queue state accordingly (remove, increment backoff, or discard).
 *   - Stop cleanly on offline or when the whole queue is drained.
 *   - Emit typed events so UI composables can react without reaching
 *     into queue internals.
 *
 * Only one `flush()` runs at a time — re-entrant calls return the same
 * in-flight promise. This matches the iOS serialized-actor semantics and
 * prevents duplicate POSTs when the user toggles connectivity rapidly.
 */
class SyncEngineImpl {
  private flushing: Promise<void> | null = null
  private readonly listeners = new Map<SyncEventType, Set<SyncEventHandler<SyncEventType>>>()

  /** Max retries for 5xx/network errors before we discard the action. */
  private readonly MAX_ATTEMPTS = 5
  /** Base backoff in ms. Actual delay = base * 2^attemptCount (capped at 5 min). */
  private readonly BASE_BACKOFF_MS = 1_000
  private readonly MAX_BACKOFF_MS = 5 * 60 * 1_000

  async flush(): Promise<void> {
    if (this.flushing) return this.flushing
    this.flushing = this.runFlush()
    try {
      await this.flushing
    } finally {
      this.flushing = null
    }
  }

  private async runFlush(): Promise<void> {
    let processed = 0
    const now = () => Date.now()

    while (navigator.onLine) {
      // Pull the oldest eligible (not in backoff) action. `nextAttemptAt` is
      // missing on legacy rows from v1 — treat absent as 0 (eligible).
      const eligible = await db.pendingActions
        .orderBy('id')
        .filter((a) => (a.nextAttemptAt ?? 0) <= now())
        .limit(1)
        .toArray()

      if (eligible.length === 0) {
        // Nothing to send right now. If the queue is non-empty, the oldest
        // row is still in backoff — treat that as a stop condition so the
        // caller knows we didn't drain.
        const remaining = await db.pendingActions.count()
        if (remaining > 0) {
          this.emit('queue-stopped', { reason: 'backoff', processed })
        } else {
          this.emit('queue-drained', { processed })
        }
        return
      }

      const action = eligible[0]!
      const id = action.id as number
      const outcome = await this.runAction(action)

      if (outcome === 'succeeded') {
        await db.pendingActions.delete(id)
        this.emit('action-succeeded', { action })
        processed++
      } else if (outcome === 'failed') {
        const latestAction = await db.pendingActions.get(id)
        const failedAction = await this.recordFailedAction(latestAction ?? action)
        await db.pendingActions.delete(id)
        this.emit('action-failed', {
          action,
          failedAction,
          reason: failedAction.reason,
        })
        processed++
      } else if (outcome === 'discard') {
        await db.pendingActions.delete(id)
        this.emit('action-discarded', {
          action,
          reason: action.lastError ?? 'permanent failure',
        })
        processed++
      } else if (outcome === 'retry') {
        // runAction already updated the row with new attemptCount + nextAttemptAt.
        // Stop processing so later actions don't starve behind this one's
        // backoff window.
        this.emit('queue-stopped', { reason: 'backoff', processed })
        return
      } else if (outcome === 'auth') {
        this.emit('queue-stopped', { reason: 'auth', processed })
        return
      } else {
        // 'abort' — stop cleanly, don't touch the row.
        this.emit('queue-stopped', { reason: 'offline', processed })
        return
      }
    }

    this.emit('queue-stopped', { reason: 'offline', processed })
  }

  private async runAction(action: PendingAction): Promise<ActionOutcome> {
    try {
      const method = action.method.toLowerCase() as 'post' | 'patch' | 'delete'
      if (method === 'delete') {
        await http.delete(action.url, action.headers)
      } else {
        await http[method](action.url, action.body, action.headers)
      }
      return 'succeeded'
    } catch (err) {
      return this.classifyError(action, err)
    }
  }

  private async classifyError(action: PendingAction, err: unknown): Promise<ActionOutcome> {
    // Network-level failure (TypeError from fetch, or explicit offline state).
    if (!navigator.onLine || !(err instanceof HttpError)) {
      return 'abort'
    }

    // 401 means the browser/session must re-authenticate before this queued
    // clinical mutation can be retried. Keep it in pendingActions untouched.
    if (err.status === 401) {
      await db.pendingActions.update(action.id as number, {
        lastError: 'HTTP 401: authentication required',
      })
      return 'auth'
    }

    // 4xx means the server rejected this exact offline mutation. Retrying the
    // same body will not help, but deleting it would silently lose clinical
    // data, so move it to failedActions for recovery/review.
    if (err.status >= 400 && err.status < 500) {
      await db.pendingActions.update(action.id as number, {
        lastError: `HTTP ${err.status}: ${err.message}`,
        lastErrorDetails: err.data,
      })
      return 'failed'
    }

    // 5xx — server is struggling. Schedule exponential backoff.
    const attemptCount = (action.attemptCount ?? 0) + 1
    if (attemptCount >= this.MAX_ATTEMPTS) {
      await db.pendingActions.update(action.id as number, {
        attemptCount,
        lastError: `HTTP ${err.status}: max attempts exceeded`,
      })
      return 'discard'
    }

    const delay = Math.min(
      this.BASE_BACKOFF_MS * 2 ** attemptCount,
      this.MAX_BACKOFF_MS,
    )
    const nextAttemptAt = Date.now() + delay
    await db.pendingActions.update(action.id as number, {
      attemptCount,
      nextAttemptAt,
      lastError: `HTTP ${err.status}`,
    })
    this.emit('action-retrying', { action: { ...action, attemptCount, nextAttemptAt }, nextAttemptAt })
    return 'retry'
  }

  private async recordFailedAction(action: PendingAction): Promise<FailedAction> {
    const failedAction: FailedAction = {
      type: action.type,
      url: action.url,
      method: action.method,
      body: action.body,
      createdAt: action.createdAt,
      attemptCount: action.attemptCount,
      nextAttemptAt: action.nextAttemptAt,
      lastError: action.lastError,
      lastErrorDetails: action.lastErrorDetails,
      originalActionId: action.id,
      failedAt: Date.now(),
      status: this.parseStatus(action.lastError),
      reason: action.lastError ?? 'HTTP 400: rejected offline mutation',
      details: action.lastErrorDetails,
    }
    const id = await db.failedActions.add(failedAction)
    return { ...failedAction, id }
  }

  private parseStatus(error?: string): number {
    const match = error?.match(/^HTTP (\d{3})/)
    return match ? Number(match[1]) : 400
  }

  async pendingCount(): Promise<number> {
    return db.pendingActions.count()
  }

  async failedCount(): Promise<number> {
    return db.failedActions.count()
  }

  on<T extends SyncEventType>(event: T, handler: SyncEventHandler<T>): () => void {
    let set = this.listeners.get(event)
    if (!set) {
      set = new Set()
      this.listeners.set(event, set)
    }
    set.add(handler as SyncEventHandler<SyncEventType>)
    return () => set?.delete(handler as SyncEventHandler<SyncEventType>)
  }

  private emit<T extends SyncEventType>(event: T, payload: SyncEventMap[T]): void {
    const set = this.listeners.get(event)
    if (!set) return
    for (const handler of set) {
      try {
        ;(handler as SyncEventHandler<T>)(payload)
      } catch {
        // listener errors are isolated — don't let one bad subscriber kill the loop
      }
    }
  }
}

export const syncEngine = new SyncEngineImpl()
export type { SyncEngineImpl as SyncEngine }
