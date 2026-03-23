<script setup lang="ts">
import { computed } from 'vue'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import OnlineDot from '@/components/OnlineDot.vue'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import type { ConversationResponse } from '../types/message.types'
import { formatMessagePreview } from '../utils/formatMessagePreview'

const props = defineProps<{
  conversation: ConversationResponse
  isActive: boolean
}>()

const emit = defineEmits<{
  select: [id: string]
}>()

const authStore = useAuthStore()

const otherParticipant = computed(() => {
  const userId = authStore.user?.id
  return props.conversation.participants.find((p) => p.id !== userId) ?? props.conversation.participants[0]
})

const initials = computed(() => {
  const name = otherParticipant.value?.name ?? '?'
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
})

const preview = computed(() => {
  if (!props.conversation.last_message_preview) return 'No messages yet'
  const isSelf = props.conversation.last_message_sender_id === authStore.user?.id
  const prefix = isSelf ? 'You: ' : ''
  return prefix + formatMessagePreview(props.conversation.last_message_preview)
})

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'now'
  if (minutes < 60) return `${minutes}m`
  if (hours < 24) return `${hours}h`
  if (days < 7) return `${days}d`

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
</script>

<template>
  <button
    type="button"
    class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent"
    :class="isActive ? 'bg-accent' : ''"
    @click="emit('select', conversation.id)"
  >
    <div class="relative shrink-0">
      <Avatar class="size-10">
        <AvatarImage v-if="otherParticipant?.avatar_url" :src="otherParticipant.avatar_url" :alt="otherParticipant.name" />
        <AvatarFallback class="text-xs">{{ initials }}</AvatarFallback>
      </Avatar>
      <OnlineDot :user-id="otherParticipant?.id ?? null" />
    </div>
    <div class="min-w-0 flex-1">
      <div class="flex items-center justify-between gap-2">
        <span class="truncate text-sm font-medium" :class="conversation.unread_count > 0 ? 'font-semibold' : ''">
          {{ otherParticipant?.name ?? 'Unknown' }}
        </span>
        <span class="shrink-0 text-[11px] text-muted-foreground">
          {{ formatRelativeTime(conversation.last_message_at) }}
        </span>
      </div>
      <div class="flex items-center justify-between gap-2">
        <p class="truncate text-xs text-muted-foreground" :class="conversation.unread_count > 0 ? 'font-medium text-foreground' : ''">
          {{ preview }}
        </p>
        <Badge v-if="conversation.unread_count > 0" class="shrink-0 px-1.5 py-0 text-[10px]">
          {{ conversation.unread_count }}
        </Badge>
      </div>
    </div>
  </button>
</template>
