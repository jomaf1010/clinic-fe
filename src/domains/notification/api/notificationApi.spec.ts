import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface MockHttp {
  get: ReturnType<typeof vi.fn>
  patch: ReturnType<typeof vi.fn>
  post: ReturnType<typeof vi.fn>
}

function makeHttp(): MockHttp {
  return {
    get: vi.fn().mockResolvedValue({ data: [] }),
    patch: vi.fn().mockResolvedValue({ data: { id: 'notification-1' } }),
    post: vi.fn().mockResolvedValue(undefined),
  }
}

async function loadApi(http: MockHttp) {
  vi.doMock('@/lib/http', () => ({ http }))
  return await import('./notificationApi')
}

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.doUnmock('@/lib/http')
})

describe('notificationApi', () => {
  it('loads notification lists and unread count', async () => {
    const http = makeHttp()
    const { notificationApi } = await loadApi(http)

    await notificationApi.list()
    await notificationApi.list(4)
    await notificationApi.unreadCount()

    expect(http.get).toHaveBeenNthCalledWith(1, '/notifications?page=1')
    expect(http.get).toHaveBeenNthCalledWith(2, '/notifications?page=4')
    expect(http.get).toHaveBeenNthCalledWith(3, '/notifications/unread-count')
  })

  it('delegates read state mutations', async () => {
    const http = makeHttp()
    const { notificationApi } = await loadApi(http)

    await notificationApi.markRead('notification-1')
    await notificationApi.markAllRead()

    expect(http.patch).toHaveBeenCalledWith('/notifications/notification-1/read')
    expect(http.post).toHaveBeenCalledWith('/notifications/mark-all-read')
  })
})
