<script setup lang="ts">
import { computed, ref } from 'vue'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Camera, LoaderCircle, User, Lock, Stethoscope, Banknote, SlidersHorizontal } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { useAuthStore } from '../stores/authStore'
import { authApi } from '../api/authApi'
import { HttpError } from '@/lib/http'
import ProfileForm from '../components/ProfileForm.vue'
import PasswordForm from '../components/PasswordForm.vue'
import CredentialsForm from '../components/CredentialsForm.vue'
import ConsultationFeeForm from '../components/ConsultationFeeForm.vue'
import PreferencesForm from '../components/PreferencesForm.vue'
import ImageCropDialog from '@/components/ImageCropDialog.vue'

const authStore = useAuthStore()
const user = computed(() => authStore.user)
const currentRole = computed(() => authStore.currentRole)

const isDoctor = computed(() => {
  const role = currentRole.value
  return role === 'doctor' || role === 'owner'
})

const initials = computed(() => {
  const n = user.value?.name ?? ''
  return n
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || '?'
})

// Avatar upload
const cropDialogOpen = ref(false)
const isUploadingAvatar = ref(false)

async function handleAvatarCrop(blob: Blob) {
  const file = new File([blob], 'avatar.png', { type: 'image/png' })

  isUploadingAvatar.value = true
  try {
    await authApi.uploadAvatar(file)
    await authStore.fetchUser()
    toast.success('Avatar updated.')
  } catch (err) {
    if (err instanceof HttpError && err.status === 422) {
      toast.error('Invalid image. Use JPG, PNG, or WebP under 2 MB.')
    } else {
      toast.error('Failed to upload avatar. Please try again.')
    }
  } finally {
    isUploadingAvatar.value = false
  }
}
</script>

<template>
  <div class="account-shell flex flex-1 flex-col gap-5 pt-6 pb-8 md:pt-8">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div class="min-w-0">
        <div class="flex min-w-0 items-center gap-3">
          <h1 class="text-2xl font-semibold tracking-normal">Account</h1>
          <Badge v-if="currentRole" variant="secondary" class="max-w-[12rem] rounded-full px-2.5 text-sm capitalize">
            <span class="truncate">{{ currentRole }}</span>
          </Badge>
        </div>
      </div>
    </div>

    <!-- Identity Card -->
    <Card class="account-card account-identity-card overflow-hidden rounded-2xl border-0 py-0">
      <CardContent class="p-5 sm:p-6">
        <div class="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-6">
          <!-- Avatar upload zone -->
          <div class="group relative shrink-0">
            <Avatar class="account-avatar size-24 ring-2 ring-white/60 ring-offset-0 dark:ring-white/10">
              <AvatarImage v-if="user?.avatar_url" :src="user.avatar_url" alt="Profile photo" />
              <AvatarFallback class="bg-gradient-to-br from-blue-500 to-teal-500 text-2xl font-semibold text-white">
                {{ initials }}
              </AvatarFallback>
            </Avatar>

            <button
              type="button"
              class="absolute inset-0 flex cursor-pointer items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              :disabled="isUploadingAvatar"
              aria-label="Upload profile photo"
              @click="cropDialogOpen = true"
            >
              <LoaderCircle v-if="isUploadingAvatar" class="size-5 animate-spin text-white" />
              <Camera v-else class="size-5 text-white" />
            </button>
          </div>

          <!-- Identity text -->
          <div class="flex min-w-0 flex-col items-center gap-2 text-center sm:items-start sm:text-left">
            <div class="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <span class="truncate text-2xl font-semibold leading-tight">
                {{ user?.name ?? 'Unnamed User' }}
              </span>
              <Badge v-if="currentRole" variant="secondary" class="rounded-full text-xs capitalize">
                {{ currentRole }}
              </Badge>
            </div>
            <span class="text-sm text-muted-foreground">{{ user?.email }}</span>
            <p class="surface-muted mt-2 rounded-full px-3 py-1.5 text-xs text-muted-foreground">
              Click your avatar to upload a new photo. JPG, PNG, or WebP up to 2 MB.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>

    <Tabs default-value="profile" size="lg" class="w-full">
      <div class="account-tabs-scroller w-full overflow-x-auto">
        <TabsList class="account-tabs-list w-max rounded-full">
          <TabsTrigger value="profile" class="account-tabs-trigger gap-1.5 rounded-full">
            <User class="size-3.5" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="password" class="account-tabs-trigger gap-1.5 rounded-full">
            <Lock class="size-3.5" />
            Password
          </TabsTrigger>
          <TabsTrigger v-if="isDoctor" value="credentials" class="account-tabs-trigger gap-1.5 rounded-full">
            <Stethoscope class="size-3.5" />
            Credentials
          </TabsTrigger>
          <TabsTrigger v-if="isDoctor" value="financial" class="account-tabs-trigger gap-1.5 rounded-full">
            <Banknote class="size-3.5" />
            Financial/Billing
          </TabsTrigger>
          <TabsTrigger v-if="isDoctor" value="preferences" class="account-tabs-trigger gap-1.5 rounded-full">
            <SlidersHorizontal class="size-3.5" />
            Preferences
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="profile" class="mt-4">
        <ProfileForm />
      </TabsContent>

      <TabsContent value="password" class="mt-4">
        <PasswordForm />
      </TabsContent>

      <TabsContent v-if="isDoctor" value="credentials" class="mt-4">
        <CredentialsForm />
      </TabsContent>

      <TabsContent v-if="isDoctor" value="financial" class="mt-4">
        <ConsultationFeeForm />
      </TabsContent>

      <TabsContent v-if="isDoctor" value="preferences" class="mt-4">
        <PreferencesForm />
      </TabsContent>
    </Tabs>

    <ImageCropDialog
      v-model:open="cropDialogOpen"
      title="Upload Avatar"
      description="Drag to reposition and use the slider to zoom."
      :output-size="512"
      @crop="handleAvatarCrop"
    />
  </div>
</template>

<style scoped>
.account-card {
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.5),
    0 24px 70px -42px rgb(15 23 42 / 0.42);
}

.account-identity-card {
  background:
    radial-gradient(circle at 18% 18%, rgb(37 99 235 / 0.14), transparent 34%),
    radial-gradient(circle at 88% 18%, rgb(20 184 166 / 0.13), transparent 34%),
    radial-gradient(circle at 56% 118%, rgb(139 92 246 / 0.08), transparent 42%),
    var(--surface-panel-strong);
}

.account-avatar {
  box-shadow:
    0 18px 42px rgb(37 99 235 / 0.18),
    0 16px 34px rgb(20 184 166 / 0.13),
    inset 0 1px 0 rgb(255 255 255 / 0.42);
}

.account-tabs-scroller {
  margin: -1rem -0.25rem;
  padding: 1rem 0.25rem;
  scrollbar-width: none;
}

.account-tabs-scroller::-webkit-scrollbar {
  display: none;
  height: 0;
}

.account-tabs-list {
  border: 0;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.5),
    0 14px 32px rgb(15 23 42 / 0.08);
}

:deep(.account-tabs-trigger[data-state='active']) {
  color: white;
  background: linear-gradient(135deg, rgb(37 99 235), rgb(20 184 166));
  box-shadow:
    0 14px 30px rgb(37 99 235 / 0.18),
    0 12px 26px rgb(20 184 166 / 0.14),
    inset 0 1px 0 rgb(255 255 255 / 0.24);
}

:global(.account-shell [data-slot='card']) {
  border: 0;
  border-radius: 1rem;
  overflow: hidden;
  background:
    radial-gradient(circle at 16% 12%, rgb(37 99 235 / 0.11), transparent 34%),
    radial-gradient(circle at 88% 8%, rgb(20 184 166 / 0.1), transparent 32%),
    radial-gradient(circle at 56% 110%, rgb(139 92 246 / 0.08), transparent 42%),
    var(--surface-panel-strong);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.5),
    0 24px 70px -42px rgb(15 23 42 / 0.42);
}

:global(.account-shell [data-slot='card']:nth-of-type(2n)) {
  background:
    radial-gradient(circle at 82% 14%, rgb(37 99 235 / 0.1), transparent 32%),
    radial-gradient(circle at 18% 0%, rgb(20 184 166 / 0.11), transparent 36%),
    radial-gradient(circle at 48% 112%, rgb(245 158 11 / 0.07), transparent 42%),
    var(--surface-panel-strong);
}

:global(.account-shell [data-slot='card-header']) {
  padding-top: 1.25rem;
}

:global(.account-shell [data-slot='card-footer']) {
  padding-bottom: 1rem;
}

:global(.dark .account-card),
:global(.dark .account-shell [data-slot='card']) {
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.05),
    0 28px 78px -44px rgb(0 0 0 / 0.82);
}

:global(.dark .account-identity-card) {
  background:
    radial-gradient(circle at 18% 18%, rgb(37 99 235 / 0.18), transparent 34%),
    radial-gradient(circle at 88% 18%, rgb(20 184 166 / 0.14), transparent 34%),
    radial-gradient(circle at 56% 118%, rgb(139 92 246 / 0.12), transparent 42%),
    var(--surface-panel-strong);
}

:global(.dark .account-tabs-list) {
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.05),
    0 16px 34px rgb(0 0 0 / 0.22);
}

:global(.dark .account-shell [data-slot='card']) {
  background:
    radial-gradient(circle at 16% 12%, rgb(37 99 235 / 0.16), transparent 34%),
    radial-gradient(circle at 88% 8%, rgb(20 184 166 / 0.13), transparent 32%),
    radial-gradient(circle at 56% 110%, rgb(139 92 246 / 0.12), transparent 42%),
    var(--surface-panel-strong);
}

:global(.dark .account-shell [data-slot='card']:nth-of-type(2n)) {
  background:
    radial-gradient(circle at 82% 14%, rgb(37 99 235 / 0.14), transparent 32%),
    radial-gradient(circle at 18% 0%, rgb(20 184 166 / 0.14), transparent 36%),
    radial-gradient(circle at 48% 112%, rgb(245 158 11 / 0.1), transparent 42%),
    var(--surface-panel-strong);
}

</style>
