<script setup lang="ts">
import { computed, ref } from 'vue'
import { Search } from 'lucide-vue-next'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { ConversationResponse } from '../types/message.types'
import ConversationListItem from './ConversationListItem.vue'

const props = defineProps<{
  conversations: ConversationResponse[]
  activeId: string | null
}>()

const emit = defineEmits<{
  select: [id: string]
}>()

const search = ref('')

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return props.conversations
  return props.conversations.filter((c) =>
    c.participants.some((p) => p.name.toLowerCase().includes(q)),
  )
})
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
    <div class="p-3">
      <div class="relative">
        <Search class="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          v-model="search"
          type="text"
          placeholder="Search conversations..."
          class="h-8 w-full rounded-md border bg-muted/50 pl-8 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>
    </div>
    <ScrollArea class="flex-1">
      <div class="flex flex-col gap-0.5 px-2 pb-2">
        <ConversationListItem
          v-for="conversation in filtered"
          :key="conversation.id"
          :conversation="conversation"
          :is-active="conversation.id === activeId"
          @select="emit('select', $event)"
        />
        <div v-if="filtered.length === 0" class="px-3 py-8 text-center">
          <p class="text-sm text-muted-foreground">
            {{ search ? 'No conversations found' : 'No conversations yet' }}
          </p>
        </div>
      </div>
    </ScrollArea>
  </div>
</template>
