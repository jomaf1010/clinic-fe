export interface Participant {
  id: string
  name: string
}

export interface ConversationResponse {
  id: string
  type: 'dm'
  participants: Participant[]
  last_message_at: string | null
  last_message_preview: string | null
  last_message_sender_id: string | null
  unread_count: number
  created_at: string
  updated_at: string
}

export interface MessageResponse {
  id: string
  conversation_id: string
  sender_id: string
  sender_name: string
  body: string
  read_by: { user_id: string; read_at: string }[]
  created_at: string
}

export interface ConversationListResponse {
  data: ConversationResponse[]
}

export interface MessageListResponse {
  data: MessageResponse[]
  meta: {
    has_more: boolean
  }
}

export interface UnreadCountsResponse {
  data: {
    conversations: Record<string, number>
    total: number
  }
}

export interface StartConversationPayload {
  recipient_id: string
}

export interface SendMessagePayload {
  body: string
}

export interface DmNewMessageEvent {
  type: 'dm.message.new'
  timestamp: string
  data: {
    conversation_id: string
    message: MessageResponse
  }
}

export interface DmMessageReadEvent {
  type: 'dm.message.read'
  timestamp: string
  data: {
    conversation_id: string
    reader_id: string
    read_at: string
    message_ids: string[]
  }
}

export interface DmTypingEvent {
  type: 'dm.typing'
  timestamp: string
  data: {
    conversation_id: string
    user_id: string
    user_name: string
  }
}

export type DmRealtimeEvent = DmNewMessageEvent | DmMessageReadEvent | DmTypingEvent
