import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface MockHttp {
  get: ReturnType<typeof vi.fn>
  post: ReturnType<typeof vi.fn>
}

function makeHttp(): MockHttp {
  return {
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn().mockResolvedValue({ data: { id: 'message-1' } }),
  }
}

async function loadApi(http: MockHttp) {
  vi.doMock('@/lib/http', () => ({ http }))
  return await import('./messageApi')
}

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.doUnmock('@/lib/http')
})

describe('messageApi', () => {
  it('loads conversations and unread counts', async () => {
    const http = makeHttp()
    const { messageApi } = await loadApi(http)

    await messageApi.listConversations()
    await messageApi.getUnreadCounts()

    expect(http.get).toHaveBeenNthCalledWith(1, '/conversations')
    expect(http.get).toHaveBeenNthCalledWith(2, '/conversations/unread-counts')
  })

  it('builds message list requests with optional before cursor', async () => {
    const http = makeHttp()
    const { messageApi } = await loadApi(http)

    await messageApi.listMessages('conversation-1')
    await messageApi.listMessages('conversation-1', 'message-1')

    expect(http.get).toHaveBeenNthCalledWith(1, '/conversations/conversation-1/messages')
    expect(http.get).toHaveBeenNthCalledWith(2, '/conversations/conversation-1/messages?before=message-1')
  })

  it('delegates conversation and message mutations', async () => {
    const http = makeHttp()
    const { messageApi } = await loadApi(http)
    const startPayload = { patient_id: 'patient-1' }
    const messagePayload = { body: 'Hello patient' }

    await messageApi.startConversation(startPayload)
    await messageApi.sendMessage('conversation-1', messagePayload)
    await messageApi.markRead('conversation-1')
    await messageApi.sendTyping('conversation-1')

    expect(http.post).toHaveBeenNthCalledWith(1, '/conversations', startPayload)
    expect(http.post).toHaveBeenNthCalledWith(2, '/conversations/conversation-1/messages', messagePayload)
    expect(http.post).toHaveBeenNthCalledWith(3, '/conversations/conversation-1/read')
    expect(http.post).toHaveBeenNthCalledWith(4, '/conversations/conversation-1/typing')
  })
})
