import { http } from '@/lib/http'
import type {
  ConversationListResponse,
  MessageListResponse,
  SendMessagePayload,
  StartConversationPayload,
  UnreadCountsResponse,
} from '../types/message.types'

export const messageApi = {
  listConversations(): Promise<ConversationListResponse> {
    return http.get<ConversationListResponse>('/conversations')
  },

  startConversation(payload: StartConversationPayload): Promise<{ data: import('../types/message.types').ConversationResponse }> {
    return http.post('/conversations', payload)
  },

  getUnreadCounts(): Promise<UnreadCountsResponse> {
    return http.get<UnreadCountsResponse>('/conversations/unread-counts')
  },

  listMessages(conversationId: string, beforeId?: string): Promise<MessageListResponse> {
    const params = new URLSearchParams()
    if (beforeId) params.set('before', beforeId)
    const qs = params.toString()
    return http.get<MessageListResponse>(`/conversations/${conversationId}/messages${qs ? `?${qs}` : ''}`)
  },

  sendMessage(conversationId: string, payload: SendMessagePayload): Promise<{ data: import('../types/message.types').MessageResponse }> {
    return http.post(`/conversations/${conversationId}/messages`, payload)
  },

  markRead(conversationId: string): Promise<{ data: { read_count: number } }> {
    return http.post(`/conversations/${conversationId}/read`)
  },

  sendTyping(conversationId: string): Promise<{ status: string }> {
    return http.post(`/conversations/${conversationId}/typing`)
  },
}
