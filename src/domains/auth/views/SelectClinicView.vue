<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/authStore'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Clock, LoaderCircle, ArrowRight } from 'lucide-vue-next'
import AppLogo from '@/components/AppLogo.vue'
import { RouteNames } from '@/router/routeNames'
import { useNeuralNetwork } from '@/composables/useNeuralNetwork'

const router = useRouter()
const authStore = useAuthStore()
const { canvasRef } = useNeuralNetwork()

const isLoading = ref<string | null>(null)
const selectError = ref<string | null>(null)

const ready = ref(false)
onMounted(() => {
  void canvasRef.value
  requestAnimationFrame(() => {
    ready.value = true
  })
})

const userName = computed(() => {
  const name = authStore.user?.name
  if (!name) return null
  return name.split(' ')[0]
})

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || '?'
}

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
  <div class="auth-shell relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8">
    <canvas ref="canvasRef" class="pointer-events-none absolute inset-0" />

    <div
      class="relative z-10 w-full max-w-2xl transition-all duration-700 ease-out"
      :class="ready ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'"
    >
      <!-- Logo -->
      <div
        class="mb-4 flex justify-center transition-all delay-100 duration-700 ease-out"
        :class="ready ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'"
      >
        <AppLogo class="h-24 w-auto" />
      </div>

      <!-- Welcome -->
      <div
        class="mb-8 text-center transition-all delay-200 duration-700 ease-out"
        :class="ready ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'"
      >
        <h1 class="text-2xl font-bold tracking-tight text-foreground">
          Welcome back{{ userName ? `, ${userName}` : '' }}!
        </h1>
        <p class="mt-1 text-sm text-muted-foreground">Select a clinic to continue</p>
      </div>

      <!-- Error -->
      <div
        v-if="selectError"
        role="alert"
        class="mx-auto mb-4 max-w-md rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-center text-sm text-destructive backdrop-blur-sm"
      >
        {{ selectError }}
      </div>

      <!-- Clinic cards grid -->
      <div
        class="grid gap-4"
        :class="authStore.memberships.length === 1 ? 'max-w-xs mx-auto' : 'grid-cols-1 sm:grid-cols-2'"
      >
        <button
          v-for="(membership, i) in authStore.memberships"
          :key="membership.id"
          class="surface-card group relative flex items-center gap-4 rounded-xl border p-4 transition-all duration-500 ease-out hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50"
          :class="ready ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'"
          :style="{ transitionDelay: `${300 + i * 100}ms` }"
          :disabled="isLoading !== null"
          @click="handleSelectClinic(membership.clinic_id)"
        >
          <!-- Loading overlay -->
          <div
            v-if="isLoading === membership.clinic_id"
            class="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-card/80 backdrop-blur-sm"
          >
            <LoaderCircle class="size-6 animate-spin text-primary" />
          </div>

          <!-- Logo -->
          <Avatar class="size-12 shrink-0 ring-2 ring-border ring-offset-2 ring-offset-card transition-transform duration-300 group-hover:scale-110">
            <AvatarImage
              v-if="membership.logo_url"
              :src="membership.logo_url"
              :alt="membership.clinic_name"
              class="object-cover"
            />
            <AvatarFallback class="bg-primary/10 text-sm font-semibold text-primary">
              <Clock v-if="membership.status === 'pending'" class="size-5 text-muted-foreground" />
              <span v-else>{{ getInitials(membership.clinic_name) }}</span>
            </AvatarFallback>
          </Avatar>

          <!-- Info -->
          <div class="flex flex-col items-start gap-0.5 text-left">
            <div class="flex items-center gap-2">
              <span class="text-base font-semibold leading-tight">{{ membership.clinic_name }}</span>
              <Badge
                v-if="membership.status === 'pending'"
                variant="secondary"
                class="text-xs"
              >
                Pending
              </Badge>
            </div>
            <span class="text-xs capitalize text-muted-foreground">{{ membership.role }}</span>
          </div>

          <ArrowRight class="ml-auto size-4 shrink-0 text-muted-foreground/0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-primary" />
        </button>
      </div>
    </div>
  </div>
</template>
