import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import { playNotificationSound } from '@/lib/notificationSound'
import { formatMessagePreview } from '../utils/formatMessagePreview'
import { messageApi } from '../api/messageApi'
import type {
  ConversationResponse,
  DmRealtimeEvent,
  MessageResponse,
} from '../types/message.types'

export const useMessageStore = defineStore('message', () => {
  const conversations = ref<ConversationResponse[]>([])
  const activeConversationId = ref<string | null>(null)
  const messages = ref<Map<string, MessageResponse[]>>(new Map())
  const typingIndicators = ref<Map<string, { userName: string; timeout: ReturnType<typeof setTimeout> }>>(new Map())
  const totalUnread = ref(0)
  const isLoading = ref(false)
  const isSending = ref(false)
  const hasMore = ref<Map<string, boolean>>(new Map())

  const activeConversation = computed(() =>
    conversations.value.find((c) => c.id === activeConversationId.value) ?? null,
  )

  const activeMessages = computed(() =>
    messages.value.get(activeConversationId.value ?? '') ?? [],
  )

  const sortedConversations = computed(() =>
    [...conversations.value].sort((a, b) => {
      if (!a.last_message_at && !b.last_message_at) return 0
      if (!a.last_message_at) return 1
      if (!b.last_message_at) return -1
      return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
    }),
  )

  const typingForConversation = computed(() => {
    const id = activeConversationId.value
    if (!id) return null
    return typingIndicators.value.get(id)?.userName ?? null
  })

  async function fetchConversations(): Promise<void> {
    isLoading.value = true
    try {
      const response = await messageApi.listConversations()
      conversations.value = response.data
    } finally {
      isLoading.value = false
    }
  }

  async function fetchUnreadCounts(): Promise<void> {
    try {
      const response = await messageApi.getUnreadCounts()
      totalUnread.value = response.data.total

      for (const conv of conversations.value) {
        conv.unread_count = response.data.conversations[conv.id] ?? 0
      }
    } catch {
      // Silently fail - non-critical
    }
  }

  async function startConversation(recipientId: string): Promise<ConversationResponse> {
    const response = await messageApi.startConversation({ recipient_id: recipientId })
    const conv = response.data

    const existing = conversations.value.find((c) => c.id === conv.id)
    if (!existing) {
      conversations.value.unshift(conv)
    }

    return conv
  }

  async function fetchMessages(conversationId: string): Promise<void> {
    isLoading.value = true
    try {
      const response = await messageApi.listMessages(conversationId)
      messages.value.set(conversationId, response.data.reverse())
      hasMore.value.set(conversationId, response.meta.has_more)
    } finally {
      isLoading.value = false
    }
  }

  async function loadMoreMessages(conversationId: string): Promise<void> {
    const existing = messages.value.get(conversationId) ?? []
    const oldestMessage = existing[0]
    if (!oldestMessage) return

    const response = await messageApi.listMessages(conversationId, oldestMessage.id)
    hasMore.value.set(conversationId, response.meta.has_more)

    if (response.data.length > 0) {
      messages.value.set(conversationId, [...response.data.reverse(), ...existing])
    }
  }

  async function sendMessage(conversationId: string, body: string): Promise<void> {
    isSending.value = true
    try {
      const response = await messageApi.sendMessage(conversationId, { body })
      const msg = response.data

      // Add to messages list (might already be added via realtime)
      const existing = messages.value.get(conversationId) ?? []
      if (!existing.find((m) => m.id === msg.id)) {
        existing.push(msg)
        messages.value.set(conversationId, [...existing])
      }

      // Update conversation preview
      const conv = conversations.value.find((c) => c.id === conversationId)
      if (conv) {
        conv.last_message_at = msg.created_at
        conv.last_message_preview = body.substring(0, 100)
        conv.last_message_sender_id = msg.sender_id
      }
    } finally {
      isSending.value = false
    }
  }

  async function markAsRead(conversationId: string): Promise<void> {
    const conv = conversations.value.find((c) => c.id === conversationId)
    if (!conv || conv.unread_count === 0) return

    const prevUnread = conv.unread_count
    conv.unread_count = 0
    totalUnread.value = Math.max(0, totalUnread.value - prevUnread)

    try {
      await messageApi.markRead(conversationId)
    } catch {
      // Revert on failure
      conv.unread_count = prevUnread
      totalUnread.value += prevUnread
    }
  }

  function handleRealtimeEvent(event: DmRealtimeEvent): void {
    const authStore = useAuthStore()
    const currentUserId = authStore.user?.id

    switch (event.type) {
      case 'dm.message.new': {
        const { conversation_id, message } = event.data
        const isSelf = message.sender_id === currentUserId
        const existing = messages.value.get(conversation_id) ?? []

        if (!existing.find((m) => m.id === message.id)) {
          existing.push(message)
          messages.value.set(conversation_id, [...existing])
        }

        // Update conversation
        const conv = conversations.value.find((c) => c.id === conversation_id)
        if (conv) {
          conv.last_message_at = message.created_at
          conv.last_message_preview = message.body.substring(0, 100)
          conv.last_message_sender_id = message.sender_id

          if (isSelf) {
            // Own message — no unread increment
          } else if (activeConversationId.value === conversation_id) {
            // Viewing this conversation — auto mark read
            markAsRead(conversation_id)
          } else {
            conv.unread_count = (conv.unread_count ?? 0) + 1
            totalUnread.value += 1
            playNotificationSound()
            const preview = formatMessagePreview(message.body)
            toast(`${message.sender_name}: ${preview.length > 50 ? preview.substring(0, 50) + '...' : preview}`)
          }
        } else if (!isSelf) {
          // New conversation not in list — increment unread and refetch
          totalUnread.value += 1
          playNotificationSound()
          toast(`${message.sender_name}: ${message.body.length > 50 ? message.body.substring(0, 50) + '...' : message.body}`)
          fetchConversations().then(() => fetchUnreadCounts())
        }

        // Clear typing indicator for this sender
        clearTyping(conversation_id)
        break
      }

      case 'dm.message.read': {
        const { conversation_id, reader_id, read_at, message_ids } = event.data
        const msgs = messages.value.get(conversation_id) ?? []

        for (const msg of msgs) {
          if (message_ids.includes(msg.id)) {
            if (!msg.read_by.find((r) => r.user_id === reader_id)) {
              msg.read_by.push({ user_id: reader_id, read_at })
            }
          }
        }

        messages.value.set(conversation_id, [...msgs])
        break
      }

      case 'dm.typing': {
        const { conversation_id, user_name } = event.data

        // Clear existing timeout
        const existing = typingIndicators.value.get(conversation_id)
        if (existing) clearTimeout(existing.timeout)

        const timeout = setTimeout(() => {
          clearTyping(conversation_id)
        }, 3000)

        typingIndicators.value.set(conversation_id, { userName: user_name, timeout })
        // Force reactivity
        typingIndicators.value = new Map(typingIndicators.value)
        break
      }
    }
  }

  function clearTyping(conversationId: string): void {
    const existing = typingIndicators.value.get(conversationId)
    if (existing) {
      clearTimeout(existing.timeout)
      typingIndicators.value.delete(conversationId)
      typingIndicators.value = new Map(typingIndicators.value)
    }
  }

  function setActiveConversation(conversationId: string | null): void {
    activeConversationId.value = conversationId
  }

  return {
    conversations,
    activeConversationId,
    messages,
    totalUnread,
    isLoading,
    isSending,
    activeConversation,
    activeMessages,
    sortedConversations,
    typingForConversation,
    hasMore,
    fetchConversations,
    fetchUnreadCounts,
    startConversation,
    fetchMessages,
    loadMoreMessages,
    sendMessage,
    markAsRead,
    handleRealtimeEvent,
    setActiveConversation,
  }
})
