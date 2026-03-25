<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ArrowLeft, LoaderCircle, MessageSquare, SquarePen } from 'lucide-vue-next'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import OnlineDot from '@/components/OnlineDot.vue'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import { useMessageStore } from '../stores/messageStore'
import { useTypingIndicator } from '../composables/useTypingIndicator'
import ConversationList from './ConversationList.vue'
import MessageThread from './MessageThread.vue'
import MessageInput from './MessageInput.vue'
import NewConversationDialog from './NewConversationDialog.vue'

const props = defineProps<{
  mode: 'full' | 'panel'
}>()

const authStore = useAuthStore()
const messageStore = useMessageStore()

const newDialogOpen = ref(false)

const { onInput: onTypingInput } = useTypingIndicator(() => messageStore.activeConversationId)

const otherParticipant = computed(() => {
  const conv = messageStore.activeConversation
  if (!conv) return null
  const userId = authStore.user?.id
  return conv.participants.find((p) => p.id !== userId) ?? null
})

const otherParticipantName = computed(() => otherParticipant.value?.name ?? 'Unknown')

const otherParticipantInitials = computed(() => {
  const name = otherParticipantName.value
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
})

const showThread = computed(() => messageStore.activeConversationId !== null)

async function handleSelectConversation(id: string) {
  messageStore.setActiveConversation(id)
}

function handleBack() {
  messageStore.setActiveConversation(null)
}

async function handleSend(body: string) {
  const id = messageStore.activeConversationId
  if (!id) return
  await messageStore.sendMessage(id, body)
}

async function handleNewConversation(userId: string) {
  const conv = await messageStore.startConversation(userId)
  messageStore.setActiveConversation(conv.id)
}

onMounted(() => {
  messageStore.fetchConversations()
})
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-hidden" :class="mode === 'full' ? 'md:flex-row' : ''">
    <!-- Conversation list -->
    <div
      class="flex min-h-0 flex-col border-r overflow-hidden"
      :class="[
        mode === 'full' ? 'md:w-80 lg:w-96 md:shrink-0' : 'w-full',
        showThread && mode === 'panel' ? 'hidden' : '',
        showThread && mode === 'full' ? 'hidden md:flex' : 'flex',
      ]"
    >
      <div class="flex items-center justify-between border-b px-4 py-3" :class="mode === 'panel' ? 'pr-12' : ''">
        <h2 class="text-sm font-semibold">Messages</h2>
        <Tooltip>
          <TooltipTrigger as-child>
            <Button variant="ghost" size="icon" class="size-8" @click="newDialogOpen = true">
              <SquarePen class="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">New message</TooltipContent>
        </Tooltip>
      </div>

      <div v-if="messageStore.isLoading && messageStore.conversations.length === 0" class="flex flex-1 items-center justify-center">
        <LoaderCircle class="size-5 animate-spin text-muted-foreground" />
      </div>

      <ConversationList
        v-else
        :conversations="messageStore.sortedConversations"
        :active-id="messageStore.activeConversationId"
        class="flex-1"
        @select="handleSelectConversation"
      />
    </div>

    <!-- Message thread -->
    <div
      class="flex min-h-0 flex-1 flex-col overflow-hidden"
      :class="[
        !showThread && mode === 'panel' ? 'hidden' : '',
        !showThread && mode === 'full' ? 'hidden md:flex' : 'flex',
      ]"
    >
      <template v-if="showThread">
        <!-- Thread header -->
        <div class="flex items-center gap-2 border-b px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            class="size-8 md:hidden"
            :class="mode === 'full' ? 'md:hidden' : ''"
            @click="handleBack"
          >
            <ArrowLeft class="size-4" />
          </Button>
          <div class="relative">
            <Avatar class="size-7">
              <AvatarImage v-if="otherParticipant?.avatar_url" :src="otherParticipant.avatar_url" :alt="otherParticipantName" />
              <AvatarFallback class="text-[10px]">{{ otherParticipantInitials }}</AvatarFallback>
            </Avatar>
            <OnlineDot :user-id="otherParticipant?.id ?? null" />
          </div>
          <span class="text-sm font-semibold">{{ otherParticipantName }}</span>
        </div>

        <MessageThread />

        <MessageInput
          @send="handleSend"
          @typing="onTypingInput"
        />
      </template>

      <!-- Empty state (full mode desktop) -->
      <div v-else class="flex flex-1 items-center justify-center">
        <div class="text-center">
          <MessageSquare class="mx-auto size-12 text-muted-foreground/30" />
          <p class="mt-3 text-sm text-muted-foreground">Select a conversation to start messaging</p>
        </div>
      </div>
    </div>

    <NewConversationDialog
      v-model:open="newDialogOpen"
      @select="handleNewConversation"
    />
  </div>
</template>
