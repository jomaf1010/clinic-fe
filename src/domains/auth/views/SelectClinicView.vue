<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/authStore'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Activity, ArrowRight, Building2, Clock, LoaderCircle, Moon, ShieldCheck, Sun, UsersRound } from 'lucide-vue-next'
import AppLogo from '@/components/AppLogo.vue'
import { RouteNames } from '@/router/routeNames'
import { useTheme } from '@/composables/useTheme'
import { useNeuralNetwork } from '@/composables/useNeuralNetwork'
import AuthFeedbackAlert from '../components/AuthFeedbackAlert.vue'

const router = useRouter()
const authStore = useAuthStore()
const { canvasRef } = useNeuralNetwork()
const { isDark, toggleTheme } = useTheme()

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
  <div class="auth-shell relative flex min-h-dvh items-center justify-center overflow-x-hidden overflow-y-auto px-4 py-16 sm:px-6 sm:py-6">
    <canvas ref="canvasRef" class="pointer-events-none absolute inset-0 opacity-55" />
    <button
      type="button"
      class="auth-theme-toggle"
      :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
      @click="toggleTheme"
    >
      <Sun v-if="isDark" class="size-4" />
      <Moon v-else class="size-4" />
    </button>

    <div
      class="relative z-10 grid w-full max-w-5xl items-stretch gap-4 transition-all duration-700 ease-out sm:gap-6 lg:grid-cols-[0.92fr_1fr]"
      :class="ready ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'"
    >
      <section
        class="auth-side-panel hidden min-h-[560px] flex-col justify-between overflow-hidden rounded-3xl p-8 lg:flex"
        aria-label="Clinic selection"
      >
        <div>
          <div class="mb-10 flex justify-center">
            <AppLogo class="h-20 w-auto drop-shadow-[0_18px_38px_rgba(37,99,235,0.14)]" />
          </div>

          <div class="max-w-sm space-y-4">
            <p class="text-sm font-medium uppercase tracking-[0.16em] text-blue-600/80 dark:text-blue-300/80">
              Clinic context
            </p>
            <h1 class="text-4xl font-semibold leading-tight text-foreground">
              Choose where this session should work.
            </h1>
            <p class="text-base leading-7 text-muted-foreground">
              Your permissions, patients, schedules, and billing context follow the clinic you select.
            </p>
          </div>
        </div>

        <div class="grid gap-3">
          <div class="auth-status-row">
            <div class="auth-status-icon text-blue-600 dark:text-blue-300">
              <Building2 class="size-4" />
            </div>
            <div>
              <p class="text-sm font-semibold">Workspace scope</p>
              <p class="text-xs text-muted-foreground">Each clinic keeps its own operating context</p>
            </div>
          </div>
          <div class="auth-status-row">
            <div class="auth-status-icon text-emerald-600 dark:text-emerald-300">
              <ShieldCheck class="size-4" />
            </div>
            <div>
              <p class="text-sm font-semibold">Role-aware access</p>
              <p class="text-xs text-muted-foreground">Menus and actions follow your membership role</p>
            </div>
          </div>
          <div class="auth-status-row">
            <div class="auth-status-icon text-teal-600 dark:text-teal-300">
              <Activity class="size-4" />
            </div>
            <div>
              <p class="text-sm font-semibold">Clinical continuity</p>
              <p class="text-xs text-muted-foreground">Realtime updates connect after selection</p>
            </div>
          </div>
        </div>
      </section>

      <div
        class="flex transition-all delay-200 duration-700 ease-out"
        :class="ready ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'"
      >
        <div class="auth-onboarding-card mx-auto flex w-full min-w-0 max-w-lg flex-col justify-center rounded-2xl border-0 px-4 py-5 shadow-[0_32px_90px_-42px_oklch(0.22_0.08_245_/_0.62)] sm:min-h-[560px] sm:rounded-3xl sm:px-10 sm:py-8 lg:h-full">
          <div
            class="mb-4 flex justify-center transition-all delay-100 duration-700 ease-out lg:hidden"
            :class="ready ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'"
          >
            <div class="auth-logo-mark">
              <AppLogo class="h-11 w-auto" />
            </div>
          </div>

          <div class="mb-6 text-center">
            <div class="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-white/55 text-blue-600 shadow-[0_14px_30px_rgb(37_99_235_/_0.1)] dark:bg-white/8 dark:text-blue-300">
              <UsersRound class="size-5" />
            </div>
            <h1 class="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              Welcome back{{ userName ? `, ${userName}` : '' }}!
            </h1>
            <p class="mt-1 text-sm text-muted-foreground">Select a clinic to continue</p>
          </div>

          <AuthFeedbackAlert v-if="selectError" variant="danger" role="alert" class="mx-auto mb-4 max-w-[400px]">
            {{ selectError }}
          </AuthFeedbackAlert>

          <div
            class="mx-auto grid w-full max-w-[400px] gap-3"
            :class="authStore.memberships.length === 1 ? 'grid-cols-1' : 'grid-cols-1'"
          >
            <button
              v-for="(membership, i) in authStore.memberships"
              :key="membership.id"
              class="auth-clinic-choice group relative flex items-center gap-3 rounded-2xl p-3 text-left transition-all duration-500 ease-out hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50"
              :class="ready ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'"
              :style="{ transitionDelay: `${300 + i * 100}ms` }"
              :disabled="isLoading !== null"
              @click="handleSelectClinic(membership.clinic_id)"
            >
              <div
                v-if="isLoading === membership.clinic_id"
                class="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/60 backdrop-blur-sm dark:bg-slate-950/70"
              >
                <LoaderCircle class="size-6 animate-spin text-primary" />
              </div>

              <Avatar class="auth-clinic-avatar size-12 shrink-0">
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

              <div class="min-w-0 flex-1">
                <div class="flex min-w-0 items-center gap-2">
                  <span class="truncate text-base font-semibold leading-tight">{{ membership.clinic_name }}</span>
                  <Badge
                    v-if="membership.status === 'pending'"
                    variant="secondary"
                    class="shrink-0 text-xs"
                  >
                    Pending
                  </Badge>
                </div>
                <span class="text-xs capitalize text-muted-foreground">{{ membership.role }}</span>
              </div>

              <ArrowRight class="size-4 shrink-0 text-muted-foreground transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-primary" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth-side-panel,
.auth-onboarding-card {
  background:
    linear-gradient(135deg, rgb(255 255 255 / 0.54), rgb(255 255 255 / 0.2) 54%, rgb(255 255 255 / 0.34)),
    rgb(255 255 255 / 0.08);
  border: 1px solid rgb(255 255 255 / 0.5);
  box-shadow: 0 32px 90px -42px oklch(0.22 0.08 245 / 0.62);
  backdrop-filter: blur(30px) saturate(1.22);
  -webkit-backdrop-filter: blur(30px) saturate(1.22);
}

.auth-onboarding-card {
  background:
    linear-gradient(145deg, rgb(255 255 255 / 0.72), rgb(255 255 255 / 0.38) 58%, rgb(255 255 255 / 0.5)),
    rgb(255 255 255 / 0.14);
}

.auth-theme-toggle {
  position: absolute;
  right: 0.875rem;
  top: 0.875rem;
  z-index: 20;
  display: inline-flex;
  height: 2.25rem;
  width: 2.25rem;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  border: 1px solid rgb(255 255 255 / 0.48);
  background: rgb(255 255 255 / 0.42);
  color: rgb(15 23 42 / 0.72);
  box-shadow: 0 14px 34px rgb(15 23 42 / 0.08);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  transition: transform 120ms ease, background 120ms ease, box-shadow 120ms ease;
}

.auth-theme-toggle:hover {
  transform: translateY(-1px);
  background: rgb(255 255 255 / 0.58);
  box-shadow: 0 18px 42px rgb(15 23 42 / 0.12);
}

.auth-logo-mark,
.auth-status-icon,
.auth-clinic-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgb(255 255 255 / 0.5);
  background: rgb(255 255 255 / 0.58);
  box-shadow: 0 14px 30px rgb(37 99 235 / 0.1);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

.auth-logo-mark {
  min-height: 3.25rem;
  min-width: 3.25rem;
  border-radius: 1.5rem;
}

.auth-status-icon {
  height: 2.5rem;
  width: 2.5rem;
  flex: 0 0 auto;
  border-radius: 9999px;
}

.auth-status-row,
.auth-clinic-choice {
  border: 1px solid rgb(255 255 255 / 0.45);
  background: rgb(255 255 255 / 0.36);
  box-shadow: 0 14px 34px rgb(15 23 42 / 0.06);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

.auth-status-row {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  border-radius: 1.25rem;
  padding: 0.875rem;
}

@media (min-width: 640px) {
  .auth-theme-toggle {
    right: 1.5rem;
    top: 1.5rem;
    height: 2.5rem;
    width: 2.5rem;
  }

  .auth-logo-mark {
    min-height: 4rem;
    min-width: 4rem;
  }
}

:global(.dark .auth-clinic-choice) {
  border-color: rgb(148 163 184 / 0.14);
  background: rgb(15 23 42 / 0.46);
  box-shadow: 0 16px 38px rgb(0 0 0 / 0.24);
}

:global(.dark .auth-clinic-avatar) {
  border-color: rgb(148 163 184 / 0.14);
  background: rgb(15 23 42 / 0.72);
  box-shadow: 0 14px 30px rgb(0 0 0 / 0.24);
}
</style>
