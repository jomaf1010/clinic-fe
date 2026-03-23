<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Building2, ChevronRight, CircleCheck, LoaderCircle, Sparkles } from 'lucide-vue-next'
import { RouteNames } from '@/router/routeNames'

const open = defineModel<boolean>('open', { required: true })

const router = useRouter()
const authStore = useAuthStore()

const isLoading = ref<string | null>(null)
const errorMessage = ref<string | null>(null)

watch(open, () => {
  errorMessage.value = null
  isLoading.value = null
})

function isCurrentClinic(clinicId: string): boolean {
  return authStore.currentClinic?.id === clinicId
}

async function handleSelectClinic(clinicId: string) {
  if (isCurrentClinic(clinicId)) return

  isLoading.value = clinicId
  errorMessage.value = null
  try {
    await authStore.selectClinic(clinicId)
    open.value = false
    router.push({ name: RouteNames.HOME })
  } catch {
    errorMessage.value = 'Failed to switch clinic. Please try again.'
  } finally {
    isLoading.value = null
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md">
      <DialogHeader class="text-center">
        <div class="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10">
          <Building2 class="size-6 text-primary" />
        </div>
        <DialogTitle class="text-xl">Switch clinic</DialogTitle>
        <DialogDescription>Select which clinic you'd like to switch to</DialogDescription>
      </DialogHeader>

      <div class="flex max-h-[60vh] flex-col gap-3 overflow-y-auto">
        <p v-if="errorMessage" class="text-sm text-destructive">{{ errorMessage }}</p>

        <button
          v-for="membership in authStore.memberships"
          :key="membership.id"
          type="button"
          class="flex w-full items-center gap-3 rounded-lg border p-4 text-left transition-all"
          :class="[
            isCurrentClinic(membership.clinic_id)
              ? 'border-primary/40 bg-primary/5 ring-1 ring-primary/20'
              : membership.plan === 'pro'
                ? 'border-amber-200/60 bg-gradient-to-r from-amber-50/50 to-yellow-50/50 hover:from-amber-50 hover:to-yellow-50 dark:border-amber-800/30 dark:from-amber-950/20 dark:to-yellow-950/20 dark:hover:from-amber-950/40 dark:hover:to-yellow-950/30'
                : 'border-border hover:bg-accent/50',
            isLoading !== null && 'pointer-events-none opacity-60',
          ]"
          :disabled="isLoading !== null"
          @click="handleSelectClinic(membership.clinic_id)"
        >
          <Avatar class="size-10 shrink-0 rounded-lg">
            <AvatarImage v-if="membership.logo_url" :src="membership.logo_url" :alt="membership.clinic_name" class="rounded-lg object-cover" />
            <AvatarFallback
              class="rounded-lg text-xs font-medium"
              :class="membership.plan === 'pro' ? 'bg-gradient-to-br from-amber-100 to-yellow-100 text-amber-700 dark:from-amber-900/50 dark:to-yellow-900/50 dark:text-amber-300' : 'bg-muted text-muted-foreground'"
            >
              <Building2 class="size-5" />
            </AvatarFallback>
          </Avatar>
          <div class="flex min-w-0 flex-1 flex-col gap-0.5">
            <div class="flex items-center gap-2">
              <span class="truncate font-medium">{{ membership.clinic_name }}</span>
              <span
                v-if="membership.plan === 'pro' && !membership.is_trial"
                class="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-white"
              >
                <Sparkles class="size-2" />
                Pro
              </span>
              <span
                v-else-if="membership.plan === 'pro' && membership.is_trial"
                class="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-amber-300 bg-amber-50 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider text-amber-600 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-400"
              >
                Trial
              </span>
            </div>
            <span class="text-xs capitalize text-muted-foreground">{{ membership.role }}</span>
          </div>
          <CircleCheck v-if="isCurrentClinic(membership.clinic_id)" class="ml-auto size-4 shrink-0 text-primary" />
          <LoaderCircle v-else-if="isLoading === membership.clinic_id" class="ml-auto size-4 shrink-0 animate-spin" />
          <ChevronRight v-else class="ml-auto size-4 shrink-0 text-muted-foreground" />
        </button>
      </div>
    </DialogContent>
  </Dialog>
</template>
