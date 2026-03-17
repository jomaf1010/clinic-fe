<script setup lang="ts">
import { ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { UserX, LoaderCircle } from 'lucide-vue-next'
import { teamApi } from '../api/teamApi'
import { HttpError } from '@/lib/http'
import type { TeamMember } from '../types/team.types'

const props = defineProps<{
  open: boolean
  member: TeamMember | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  removed: []
}>()

const isLoading = ref(false)
const generalError = ref<string | null>(null)

watch(
  () => props.open,
  (open) => {
    if (open) {
      generalError.value = null
    }
  },
)

async function onConfirm() {
  if (!props.member) return

  generalError.value = null
  isLoading.value = true

  try {
    await teamApi.remove(props.member.id)

    emit('removed')
    emit('update:open', false)
  } catch (err) {
    if (err instanceof HttpError) {
      generalError.value = 'Failed to remove member. Please try again.'
    } else {
      generalError.value = 'Unable to connect to the server. Please try again.'
    }
  } finally {
    isLoading.value = false
  }
}

function getMemberDisplayName(member: TeamMember): string {
  return member.user?.name ?? member.user?.email ?? member.invited_email ?? 'this member'
}
</script>

<template>
  <Dialog :open="open" @update:open="(val) => emit('update:open', val)">
    <DialogContent class="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <UserX class="size-5 text-destructive" />
          Remove Member
        </DialogTitle>
        <DialogDescription v-if="member">
          Are you sure you want to remove
          <span class="font-medium text-foreground">{{ getMemberDisplayName(member) }}</span>
          from the clinic? This action cannot be undone.
        </DialogDescription>
      </DialogHeader>

      <div
        v-if="generalError"
        role="alert"
        class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
      >
        {{ generalError }}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" :disabled="isLoading" @click="emit('update:open', false)">
          Cancel
        </Button>
        <Button type="button" variant="destructive" :disabled="isLoading" @click="onConfirm">
          <LoaderCircle v-if="isLoading" class="size-3.5 animate-spin" />
          <UserX v-else class="size-3.5" />
          {{ isLoading ? 'Removing...' : 'Remove Member' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
