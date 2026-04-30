/**
 * Tests for the message Pinia store.
 *
 * Coverage focus per Phase 3 plan:
 *   - Conversation list + unread counts.
 *   - Message fetch + sendMessage.
 *   - markAsRead optimism + revert on failure.
 *   - Realtime: dm.message.new (self vs others, active vs background),
 *     dm.message.read, dm.typing with timeout cleanup.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ConversationResponse, MessageResponse } from '../types/message.types'

interface MockMessageApi {
  listConversations: ReturnType<typeof vi.fn>
  startConversation: ReturnType<typeof vi.fn>
  getUnreadCounts: ReturnType<typeof vi.fn>
  listMessages: ReturnType<typeof vi.fn>
  sendMessage: ReturnType<typeof vi.fn>
  markRead: ReturnType<typeof vi.fn>
  sendTyping: ReturnType<typeof vi.fn>
}

function makeConv(overrides: Partial<ConversationResponse> = {}): ConversationResponse {
  return {
    id: 'conv-1',
    type: 'dm',
    participants: [
      { id: 'u1', name: 'Me', avatar_url: null },
      { id: 'u2', name: 'Other', avatar_url: null },
    ],
    last_message_at: null,
    last_message_preview: null,
    last_message_sender_id: null,
    unread_count: 0,
    created_at: '2026-04-30T00:00:00Z',
    updated_at: '2026-04-30T00:00:00Z',
    ...overrides,
  }
}

function makeMsg(overrides: Partial<MessageResponse> = {}): MessageResponse {
  return {
    id: 'msg-1',
    conversation_id: 'conv-1',
    sender_id: 'u2',
    sender_name: 'Other',
    body: 'hello',
    read_by: [],
    created_at: '2026-04-30T00:00:00Z',
    ...overrides,
  }
}

function makeApi(overrides: Partial<MockMessageApi> = {}): MockMessageApi {
  return {
    listConversations: vi.fn().mockResolvedValue({ data: [] }),
    startConversation: vi.fn().mockResolvedValue({ data: makeConv() }),
    getUnreadCounts: vi.fn().mockResolvedValue({ data: { conversations: {}, total: 0 } }),
    listMessages: vi.fn().mockResolvedValue({ data: [], meta: { has_more: false } }),
    sendMessage: vi.fn().mockResolvedValue({ data: makeMsg() }),
    markRead: vi.fn().mockResolvedValue({ data: { read_count: 1 } }),
    sendTyping: vi.fn().mockResolvedValue({ status: 'ok' }),
    ...overrides,
  }
}

async function loadStore(api: MockMessageApi, userId: string = 'u1') {
  vi.doMock('../api/messageApi', () => ({ messageApi: api }))
  vi.doMock('vue-sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn() }) }))
  vi.doMock('@/lib/notificationSound', () => ({ playNotificationSound: vi.fn() }))
  vi.doMock('@/domains/auth/stores/authStore', () => ({
    useAuthStore: () => ({ user: { id: userId } }),
  }))
  return await import('./messageStore')
}

beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers({ shouldAdvanceTime: true })
})

afterEach(() => {
  vi.useRealTimers()
  vi.doUnmock('../api/messageApi')
  vi.doUnmock('vue-sonner')
  vi.doUnmock('@/lib/notificationSound')
  vi.doUnmock('@/domains/auth/stores/authStore')
})

describe('messageStore — fetchConversations + unread counts', () => {
  it('fetchConversations populates the list', async () => {
    const api = makeApi({
      listConversations: vi.fn().mockResolvedValue({ data: [makeConv({ id: 'A' }), makeConv({ id: 'B' })] }),
    })
    const { useMessageStore } = await loadStore(api)
    const store = useMessageStore()
    await store.fetchConversations()
    expect(store.conversations).toHaveLength(2)
  })

  it('fetchUnreadCounts updates totalUnread and per-conversation counts', async () => {
    const api = makeApi({
      listConversations: vi.fn().mockResolvedValue({
        data: [makeConv({ id: 'A', unread_count: 0 }), makeConv({ id: 'B', unread_count: 0 })],
      }),
      getUnreadCounts: vi.fn().mockResolvedValue({
        data: { conversations: { A: 2, B: 5 }, total: 7 },
      }),
    })
    const { useMessageStore } = await loadStore(api)
    const store = useMessageStore()
    await store.fetchConversations()
    await store.fetchUnreadCounts()

    expect(store.totalUnread).toBe(7)
    expect(store.conversations[0]?.unread_count).toBe(2)
    expect(store.conversations[1]?.unread_count).toBe(5)
  })
})

describe('messageStore — fetchMessages + sendMessage', () => {
  it('fetchMessages reverses the API order (newest-first → oldest-first)', async () => {
    const api = makeApi({
      listMessages: vi.fn().mockResolvedValue({
        data: [makeMsg({ id: 'msg-3' }), makeMsg({ id: 'msg-2' }), makeMsg({ id: 'msg-1' })],
        meta: { has_more: true },
      }),
    })
    const { useMessageStore } = await loadStore(api)
    const store = useMessageStore()
    await store.fetchMessages('conv-1')

    expect(store.messages.get('conv-1')?.map((m) => m.id)).toEqual(['msg-1', 'msg-2', 'msg-3'])
    expect(store.hasMore.get('conv-1')).toBe(true)
  })

  it('sendMessage appends a new message and updates conversation preview', async () => {
    const api = makeApi({
      sendMessage: vi.fn().mockResolvedValue({
        data: makeMsg({ id: 'msg-X', sender_id: 'u1', sender_name: 'Me', body: 'reply' }),
      }),
    })
    const { useMessageStore } = await loadStore(api)
    const store = useMessageStore()
    store.conversations = [makeConv({ id: 'conv-1' })]

    await store.sendMessage('conv-1', 'reply')

    expect(store.messages.get('conv-1')?.[0]?.id).toBe('msg-X')
    expect(store.conversations[0]?.last_message_preview).toBe('reply')
    expect(store.conversations[0]?.last_message_sender_id).toBe('u1')
  })
})

describe('messageStore — markAsRead', () => {
  it('optimistically zeroes unread, calls API, keeps zero on success', async () => {
    const api = makeApi()
    const { useMessageStore } = await loadStore(api)
    const store = useMessageStore()
    store.conversations = [makeConv({ id: 'conv-1', unread_count: 4 })]
    store.totalUnread = 4

    await store.markAsRead('conv-1')

    expect(store.conversations[0]?.unread_count).toBe(0)
    expect(store.totalUnread).toBe(0)
    expect(api.markRead).toHaveBeenCalledWith('conv-1')
  })

  it('reverts the optimistic write when the API rejects', async () => {
    const api = makeApi({
      markRead: vi.fn().mockRejectedValue(new Error('oops')),
    })
    const { useMessageStore } = await loadStore(api)
    const store = useMessageStore()
    store.conversations = [makeConv({ id: 'conv-1', unread_count: 4 })]
    store.totalUnread = 4

    await store.markAsRead('conv-1')

    expect(store.conversations[0]?.unread_count).toBe(4)
    expect(store.totalUnread).toBe(4)
  })

  it('is a no-op when the conversation already has zero unread', async () => {
    const api = makeApi()
    const { useMessageStore } = await loadStore(api)
    const store = useMessageStore()
    store.conversations = [makeConv({ id: 'conv-1', unread_count: 0 })]
    await store.markAsRead('conv-1')
    expect(api.markRead).not.toHaveBeenCalled()
  })
})

describe('messageStore — handleRealtimeEvent', () => {
  it('dm.message.new from another user in a background conversation increments unread', async () => {
    const api = makeApi()
    const { useMessageStore } = await loadStore(api, 'u1')
    const store = useMessageStore()
    store.conversations = [makeConv({ id: 'conv-1', unread_count: 0 })]
    store.activeConversationId = null
    store.totalUnread = 0

    store.handleRealtimeEvent({
      type: 'dm.message.new',
      timestamp: '2026-04-30T00:00:00Z',
      data: {
        conversation_id: 'conv-1',
        message: makeMsg({ id: 'msg-NEW', sender_id: 'u2' }),
      },
    })

    expect(store.conversations[0]?.unread_count).toBe(1)
    expect(store.totalUnread).toBe(1)
  })

  it('dm.message.new from self does not increment unread', async () => {
    const api = makeApi()
    const { useMessageStore } = await loadStore(api, 'u1')
    const store = useMessageStore()
    store.conversations = [makeConv({ id: 'conv-1', unread_count: 0 })]
    store.totalUnread = 0

    store.handleRealtimeEvent({
      type: 'dm.message.new',
      timestamp: '2026-04-30T00:00:00Z',
      data: {
        conversation_id: 'conv-1',
        message: makeMsg({ id: 'msg-SELF', sender_id: 'u1', sender_name: 'Me' }),
      },
    })

    expect(store.conversations[0]?.unread_count).toBe(0)
    expect(store.totalUnread).toBe(0)
  })

  it('dm.message.read marks the matching messages with read_by entry', async () => {
    const api = makeApi()
    const { useMessageStore } = await loadStore(api, 'u1')
    const store = useMessageStore()
    const msg = makeMsg({ id: 'msg-1', read_by: [] })
    store.messages.set('conv-1', [msg])

    store.handleRealtimeEvent({
      type: 'dm.message.read',
      timestamp: '2026-04-30T00:00:00Z',
      data: {
        conversation_id: 'conv-1',
        reader_id: 'u2',
        read_at: '2026-04-30T01:00:00Z',
        message_ids: ['msg-1'],
      },
    })

    expect(store.messages.get('conv-1')?.[0]?.read_by).toEqual([
      { user_id: 'u2', read_at: '2026-04-30T01:00:00Z' },
    ])
  })

  it('dm.typing sets the typing indicator, then auto-clears after 3s', async () => {
    const api = makeApi()
    const { useMessageStore } = await loadStore(api, 'u1')
    const store = useMessageStore()
    store.activeConversationId = 'conv-1'

    store.handleRealtimeEvent({
      type: 'dm.typing',
      timestamp: '2026-04-30T00:00:00Z',
      data: { conversation_id: 'conv-1', user_id: 'u2', user_name: 'Other' },
    })

    expect(store.typingForConversation).toBe('Other')

    vi.advanceTimersByTime(3001)
    expect(store.typingForConversation).toBeNull()
  })
})
