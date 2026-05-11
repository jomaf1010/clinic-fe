import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resetIndexedDb } from '@/__tests__/helpers/mockDexie'
import type { PendingAction } from '../db'

class MockHttpError extends Error {
  readonly status: number
  readonly data?: unknown

  constructor(status: number, message: string, data?: unknown) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.data = data
  }
}

const httpPatch = vi.fn()
const httpPost = vi.fn()
const httpDelete = vi.fn()
const openedDbs: Array<{ close: () => void }> = []

async function importSyncModules() {
  vi.doMock('../http', () => ({
    HttpError: MockHttpError,
    http: {
      patch: httpPatch,
      post: httpPost,
      delete: httpDelete,
    },
  }))

  const [{ db }, { syncEngine }] = await Promise.all([
    import('../db'),
    import('./SyncEngine'),
  ])

  openedDbs.push(db)
  return { db, syncEngine }
}

describe('SyncEngine', () => {
  beforeEach(async () => {
    while (openedDbs.length > 0) openedDbs.pop()?.close()
    vi.resetModules()
    await resetIndexedDb()
    httpPatch.mockReset()
    httpPost.mockReset()
    httpDelete.mockReset()
  })

  it('passes queued mutation headers through to the HTTP client', async () => {
    const { db, syncEngine } = await importSyncModules()
    await db.pendingActions.add({
      type: 'update-encounter',
      url: '/encounters/enc-1',
      method: 'PATCH',
      body: { assessment: { chief_complaint: 'offline edit' } },
      headers: { 'X-Expected-Updated-At': '2026-04-30T00:00:00Z' },
      createdAt: 1_700_000_000_000,
    })
    httpPatch.mockResolvedValueOnce({ data: { id: 'enc-1' } })

    await syncEngine.flush()

    expect(httpPatch).toHaveBeenCalledWith(
      '/encounters/enc-1',
      { assessment: { chief_complaint: 'offline edit' } },
      { 'X-Expected-Updated-At': '2026-04-30T00:00:00Z' },
    )
    await expect(db.pendingActions.count()).resolves.toBe(0)
  })

  it('moves 4xx clinical mutations to failed actions instead of silently discarding them', async () => {
    const { db, syncEngine } = await importSyncModules()
    const action: PendingAction = {
      type: 'update-encounter',
      url: '/encounters/enc-1',
      method: 'PATCH',
      body: { assessment: { chief_complaint: 'offline edit' } },
      createdAt: 1_700_000_000_000,
    }
    await db.pendingActions.add(action)
    httpPatch.mockRejectedValueOnce(new MockHttpError(422, 'Request failed with status 422', {
      message: 'Chief complaint is required',
      errors: { chief_complaint: ['Required'] },
    }))
    const failedHandler = vi.fn()
    syncEngine.on('action-failed', failedHandler)

    await syncEngine.flush()

    await expect(db.pendingActions.count()).resolves.toBe(0)
    const failedActions = await db.failedActions.toArray()
    expect(failedActions).toHaveLength(1)
    expect(failedActions[0]).toEqual(expect.objectContaining({
      type: 'update-encounter',
      url: '/encounters/enc-1',
      method: 'PATCH',
      body: { assessment: { chief_complaint: 'offline edit' } },
      status: 422,
      reason: 'HTTP 422: Request failed with status 422',
    }))
    expect(failedActions[0]?.details).toEqual({
      message: 'Chief complaint is required',
      errors: { chief_complaint: ['Required'] },
    })
    expect(failedHandler).toHaveBeenCalledWith(expect.objectContaining({
      failedAction: expect.objectContaining({ status: 422, type: 'update-encounter' }),
    }))
  })

  it('pauses sync on 401 and keeps the pending mutation for re-authenticated retry', async () => {
    const { db, syncEngine } = await importSyncModules()
    await db.pendingActions.add({
      type: 'update-lab-order-item',
      url: '/lab-orders/order-1/items/item-1',
      method: 'PATCH',
      body: { result: 'pending' },
      createdAt: 1_700_000_000_001,
    })
    httpPatch.mockRejectedValueOnce(new MockHttpError(401, 'Unauthorized'))
    const stoppedHandler = vi.fn()
    syncEngine.on('queue-stopped', stoppedHandler)

    await syncEngine.flush()

    await expect(db.pendingActions.count()).resolves.toBe(1)
    const failedForAction = await db.failedActions.where('type').equals('update-lab-order-item').toArray()
    expect(failedForAction).toHaveLength(0)
    expect(stoppedHandler).toHaveBeenCalledWith({ reason: 'auth', processed: 0 })
  })
})
