<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { ChevronUp, LoaderCircle } from 'lucide-vue-next'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import { useMessageStore } from '../stores/messageStore'
import MessageBubble from './MessageBubble.vue'
import TypingIndicator from './TypingIndicator.vue'

const authStore = useAuthStore()
const messageStore = useMessageStore()

const bottomAnchor = ref<HTMLDivElement | null>(null)
const isLoadingMore = ref(false)
const lastMessageId = ref<string | null>(null)

const userId = computed(() => authStore.user?.id ?? '')
const conversationId = computed(() => messageStore.activeConversationId)
const messages = computed(() => messageStore.activeMessages)

const canLoadMore = computed(() => {
  const id = conversationId.value
  if (!id) return false
  return messageStore.hasMore.get(id) ?? false
})

function isRead(message: { sender_id: string; read_by: { user_id: string }[] }): boolean {
  return message.read_by.some((r) => r.user_id !== message.sender_id)
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  })
}

function shouldShowDate(index: number): boolean {
  if (index === 0) return true
  const prev = messages.value[index - 1]
  const curr = messages.value[index]
  if (!prev || !curr) return false
  return new Date(prev.created_at).toDateString() !== new Date(curr.created_at).toDateString()
}

function scrollToBottom() {
  nextTick(() => {
    setTimeout(() => {
      bottomAnchor.value?.scrollIntoView({ block: 'end' })
    }, 50)
  })
}

async function loadMore() {
  const id = conversationId.value
  if (!id || isLoadingMore.value) return

  isLoadingMore.value = true
  const firstMsgId = messages.value[0]?.id

  try {
    await messageStore.loadMoreMessages(id)
  } finally {
    isLoadingMore.value = false

    // Restore scroll to where the user was
    if (firstMsgId) {
      nextTick(() => {
        setTimeout(() => {
          const el = document.getElementById(`msg-${firstMsgId}`)
          el?.scrollIntoView({ block: 'start' })
        }, 50)
      })
    }
  }
}

// Only scroll to bottom when a NEW message is appended at the end (last message changed)
watch(messages, (msgs) => {
  const newLastId = msgs.length > 0 ? msgs[msgs.length - 1]!.id : null

  if (newLastId && newLastId !== lastMessageId.value) {
    lastMessageId.value = newLastId
    scrollToBottom()
  }
}, { deep: true })

watch(conversationId, async (id) => {
  lastMessageId.value = null
  if (id) {
    await messageStore.fetchMessages(id)
    await messageStore.markAsRead(id)
    const msgs = messageStore.activeMessages
    lastMessageId.value = msgs.length > 0 ? msgs[msgs.length - 1]!.id : null
    scrollToBottom()
  }
})

onMounted(async () => {
  if (conversationId.value) {
    await messageStore.fetchMessages(conversationId.value)
    await messageStore.markAsRead(conversationId.value)
    const msgs = messageStore.activeMessages
    lastMessageId.value = msgs.length > 0 ? msgs[msgs.length - 1]!.id : null
    scrollToBottom()
  }
})
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
    <ScrollArea class="min-h-0 flex-1">
      <div class="flex flex-col gap-1.5 p-4">
        <!-- Load more button -->
        <div v-if="canLoadMore" class="flex justify-center pb-2">
          <Button variant="ghost" size="sm" :disabled="isLoadingMore" @click="loadMore">
            <ChevronUp v-if="!isLoadingMore" class="mr-1 size-3.5" />
            <LoaderCircle v-else class="mr-1.5 size-3.5 animate-spin" />
            Load earlier messages
          </Button>
        </div>

        <!-- Messages -->
        <template v-for="(message, index) in messages" :key="message.id">
          <div v-if="shouldShowDate(index)" class="flex items-center justify-center py-2">
            <span class="rounded-full bg-muted px-3 py-0.5 text-[11px] text-muted-foreground">
              {{ formatDate(message.created_at) }}
            </span>
          </div>
          <div :id="`msg-${message.id}`">
            <MessageBubble
              :message="message"
              :is-own="message.sender_id === userId"
              :is-read="isRead(message)"
            />
          </div>
        </template>

        <!-- Empty state -->
        <div v-if="!messageStore.isLoading && messages.length === 0" class="flex flex-1 items-center justify-center py-12">
          <p class="text-sm text-muted-foreground">No messages yet. Send the first one!</p>
        </div>

        <!-- Scroll anchor -->
        <div ref="bottomAnchor" />
      </div>
    </ScrollArea>

    <!-- Typing indicator -->
    <TypingIndicator
      v-if="messageStore.typingForConversation"
      :user-name="messageStore.typingForConversation"
    />
  </div>
</template>
