<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useAuthStore } from '../stores/authStore'
import { Badge } from '@/components/ui/badge'
import { Building2, ChevronRight, Clock, LoaderCircle } from 'lucide-vue-next'
import { RouteNames } from '@/router/routeNames'

const router = useRouter()
const authStore = useAuthStore()

const isLoading = ref<string | null>(null)
const selectError = ref<string | null>(null)

async function handleSelectClinic(clinicId: string) {
  isLoading.value = clinicId
  selectError.value = null
  try {
    await authStore.selectClinic(clinicId)
    router.push({ name: RouteNames.HOME })
  } catch {
    selectError.value = 'Failed to select clinic. Please try again.'
  } finally {
    isLoading.value = null
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-background px-4 py-8">
    <div class="w-full max-w-sm">
      <div class="mb-4 flex justify-center">
        <img src="@/assets/logo.svg" alt="MediFlow" class="h-48 w-auto" />
      </div>

      <Card>
        <CardHeader class="text-center">
          <CardTitle class="text-xl">Select a clinic</CardTitle>
          <CardDescription>Choose which clinic you'd like to work in</CardDescription>
        </CardHeader>

        <CardContent>
          <div
            v-if="selectError"
            role="alert"
            class="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
          >
            {{ selectError }}
          </div>
          <div class="flex max-h-[13.5rem] flex-col gap-3 overflow-y-auto">
            <Button
              v-for="membership in authStore.memberships"
              :key="membership.id"
              variant="outline"
              class="flex h-auto w-full items-center gap-3 p-4"
              :disabled="isLoading !== null"
              @click="handleSelectClinic(membership.clinic_id)"
            >
              <div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Clock v-if="membership.status === 'pending'" class="size-5 text-muted-foreground" />
                <Building2 v-else class="size-5 text-muted-foreground" />
              </div>
              <div class="flex flex-col items-start gap-0.5">
                <div class="flex items-center gap-2">
                  <span class="font-medium">{{ membership.clinic_name }}</span>
                  <Badge v-if="membership.status === 'pending'" variant="secondary" class="text-xs">
                    Pending
                  </Badge>
                </div>
                <span class="text-xs capitalize text-muted-foreground">
                  {{ membership.status === 'pending' ? 'Accept & Enter' : membership.role }}
                </span>
              </div>
              <LoaderCircle v-if="isLoading === membership.clinic_id" class="ml-auto size-4 animate-spin" />
              <ChevronRight v-else class="ml-auto size-4 text-muted-foreground" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
