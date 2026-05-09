import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resetIndexedDb } from '@/__tests__/helpers/mockDexie'

const openedDbs: Array<{ close: () => void }> = []

async function importOfflineDb() {
  const [{ db }, offlineDb] = await Promise.all([
    import('./db'),
    import('./offlineDb'),
  ])
  openedDbs.push(db)
  return { db, ...offlineDb }
}

describe('offlineDb queueAction', () => {
  beforeEach(async () => {
    while (openedDbs.length > 0) openedDbs.pop()?.close()
    vi.resetModules()
    await resetIndexedDb()
  })

  it('coalesces multiple pending encounter updates behind the original lock token', async () => {
    const { db, queueAction } = await importOfflineDb()
    const url = '/encounters/offline-db-spec-lock-token'

    await queueAction({
      type: 'update-encounter',
      url,
      method: 'PATCH',
      body: {
        triage: { chief_complaint: 'Cough', temperature_c: 38 },
      },
      headers: { 'X-Expected-Updated-At': '2026-04-30T00:00:00Z' },
      createdAt: 1_700_000_000_000,
    })
    await queueAction({
      type: 'update-encounter',
      url,
      method: 'PATCH',
      body: {
        triage: { temperature_c: 37.5 },
        assessment: { diagnosis: 'URI' },
      },
      headers: { 'X-Expected-Updated-At': '2026-04-30T00:05:00Z' },
      createdAt: 1_700_000_000_500,
    })

    const queued = (await db.pendingActions.toArray()).filter((action) => action.url === url)

    expect(queued).toHaveLength(1)
    expect(queued[0]).toEqual(expect.objectContaining({
      type: 'update-encounter',
      url,
      method: 'PATCH',
      headers: { 'X-Expected-Updated-At': '2026-04-30T00:00:00Z' },
      body: {
        triage: { chief_complaint: 'Cough', temperature_c: 37.5 },
        assessment: { diagnosis: 'URI' },
      },
    }))
  })

  it('keeps unrelated pending actions as separate queue entries', async () => {
    const { db, queueAction } = await importOfflineDb()
    const urls = ['/encounters/offline-db-spec-unrelated-1', '/encounters/offline-db-spec-unrelated-2']

    await queueAction({
      type: 'update-encounter',
      url: urls[0],
      method: 'PATCH',
      body: { assessment: { diagnosis: 'URI' } },
      headers: { 'X-Expected-Updated-At': '2026-04-30T00:00:00Z' },
      createdAt: 1,
    })
    await queueAction({
      type: 'update-encounter',
      url: urls[1],
      method: 'PATCH',
      body: { assessment: { diagnosis: 'Well' } },
      headers: { 'X-Expected-Updated-At': '2026-04-30T00:00:00Z' },
      createdAt: 2,
    })

    const queued = (await db.pendingActions.toArray()).filter((action) => urls.includes(action.url))
    expect(queued).toHaveLength(2)
  })
})
