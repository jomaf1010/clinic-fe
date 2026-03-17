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
import { Building2, ChevronRight, CircleCheck, LoaderCircle } from 'lucide-vue-next'
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

        <Button
          v-for="membership in authStore.memberships"
          :key="membership.id"
          :variant="isCurrentClinic(membership.clinic_id) ? 'secondary' : 'outline'"
          class="flex h-auto w-full items-center gap-3 p-4"
          :disabled="isLoading !== null"
          @click="handleSelectClinic(membership.clinic_id)"
        >
          <div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Building2 class="size-5 text-muted-foreground" />
          </div>
          <div class="flex flex-col items-start gap-0.5">
            <span class="font-medium">{{ membership.clinic_name }}</span>
            <span class="text-xs capitalize text-muted-foreground">{{ membership.role }}</span>
          </div>
          <CircleCheck v-if="isCurrentClinic(membership.clinic_id)" class="ml-auto size-4 text-primary" />
          <LoaderCircle v-else-if="isLoading === membership.clinic_id" class="ml-auto size-4 animate-spin" />
          <ChevronRight v-else class="ml-auto size-4 text-muted-foreground" />
        </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>
