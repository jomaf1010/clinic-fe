<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { LoaderCircle, MessageSquarePlus, Search, Users } from 'lucide-vue-next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import { teamApi } from '@/domains/team/api/teamApi'
import type { TeamMember } from '@/domains/team/types/team.types'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  select: [userId: string]
}>()

const authStore = useAuthStore()
const members = ref<TeamMember[]>([])
const isLoading = ref(false)
const search = ref('')

const filteredMembers = computed(() => {
  const userId = authStore.user?.id
  const q = search.value.trim().toLowerCase()

  return members.value.filter((m) => {
    if (m.user_id === userId) return false
    if (m.status !== 'active') return false
    if (!m.user_id) return false
    if (!q) return true
    const name = (m.user?.name ?? m.user?.email ?? '').toLowerCase()
    return name.includes(q)
  })
})

watch(() => props.open, async (isOpen) => {
  if (isOpen) {
    search.value = ''
    isLoading.value = true
    try {
      const response = await teamApi.list({ status: 'active' })
      members.value = response.data
    } catch {
      members.value = []
    } finally {
      isLoading.value = false
    }
  }
})

function selectMember(member: TeamMember) {
  if (!member.user_id) return
  emit('select', member.user_id)
  emit('update:open', false)
}

function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <MessageSquarePlus class="size-4" />
          New Message
        </DialogTitle>
        <DialogDescription>Select a team member to start a conversation</DialogDescription>
      </DialogHeader>

      <div class="relative">
        <Search class="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          v-model="search"
          type="text"
          placeholder="Search members..."
          class="h-9 w-full rounded-md border bg-muted/50 pl-8 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      <ScrollArea class="max-h-64">
        <div v-if="isLoading" class="flex items-center justify-center py-8">
          <LoaderCircle class="size-5 animate-spin text-muted-foreground" />
        </div>

        <div v-else-if="filteredMembers.length === 0" class="py-8 text-center">
          <Users class="mx-auto size-8 text-muted-foreground/50" />
          <p class="mt-2 text-sm text-muted-foreground">No members found</p>
        </div>

        <div v-else class="flex flex-col gap-0.5">
          <button
            v-for="member in filteredMembers"
            :key="member.id"
            type="button"
            class="flex items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-accent"
            @click="selectMember(member)"
          >
            <Avatar class="size-9">
              <AvatarImage v-if="member.user?.avatar_url" :src="member.user.avatar_url" :alt="member.user?.name ?? ''" />
              <AvatarFallback class="text-xs">
                {{ getInitials(member.user?.name ?? member.user?.email ?? '?') }}
              </AvatarFallback>
            </Avatar>
            <div class="min-w-0">
              <p class="truncate text-sm font-medium">{{ member.user?.name ?? member.user?.email }}</p>
              <p class="truncate text-xs text-muted-foreground capitalize">{{ member.role }}</p>
            </div>
          </button>
        </div>
      </ScrollArea>
    </DialogContent>
  </Dialog>
</template>
