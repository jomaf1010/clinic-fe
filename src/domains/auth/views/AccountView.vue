<script setup lang="ts">
import { computed, ref, onUnmounted } from 'vue'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Camera, LoaderCircle, User, Lock, Stethoscope } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { useAuthStore } from '../stores/authStore'
import { authApi } from '../api/authApi'
import { HttpError } from '@/lib/http'
import ProfileForm from '../components/ProfileForm.vue'
import PasswordForm from '../components/PasswordForm.vue'
import CredentialsForm from '../components/CredentialsForm.vue'

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
const fileInputRef = ref<HTMLInputElement | null>(null)
const avatarPreviewUrl = ref<string | null>(null)
const isUploadingAvatar = ref(false)

const displayAvatarUrl = computed(() => avatarPreviewUrl.value ?? user.value?.avatar_url ?? null)

function triggerFileInput(): void {
  fileInputRef.value?.click()
}

async function handleFileChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  if (file.size > 2 * 1024 * 1024) {
    toast.error('File must be under 2 MB.')
    return
  }

  if (avatarPreviewUrl.value) URL.revokeObjectURL(avatarPreviewUrl.value)
  avatarPreviewUrl.value = URL.createObjectURL(file)

  isUploadingAvatar.value = true
  try {
    await authApi.uploadAvatar(file)
    await authStore.fetchUser()
    toast.success('Avatar updated.')
  } catch (err) {
    if (avatarPreviewUrl.value) URL.revokeObjectURL(avatarPreviewUrl.value)
    avatarPreviewUrl.value = null
    if (err instanceof HttpError && err.status === 422) {
      toast.error('Invalid image. Use JPG, PNG, or WebP under 2 MB.')
    } else {
      toast.error('Failed to upload avatar. Please try again.')
    }
  } finally {
    isUploadingAvatar.value = false
    input.value = ''
  }
}

onUnmounted(() => {
  if (avatarPreviewUrl.value) URL.revokeObjectURL(avatarPreviewUrl.value)
})
</script>

<template>
  <div class="flex flex-col gap-6 p-4 pb-8">
    <div>
      <h1 class="text-2xl font-bold tracking-tight">Account</h1>
      <p class="mt-1 text-sm text-muted-foreground">Manage your personal information and security settings</p>
    </div>

    <!-- Identity Card -->
    <Card>
      <CardContent class="pt-6">
        <div class="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-6">
          <!-- Avatar upload zone -->
          <div class="group relative shrink-0">
            <Avatar class="size-20 ring-2 ring-border ring-offset-2 ring-offset-background">
              <AvatarImage v-if="displayAvatarUrl" :src="displayAvatarUrl" alt="Profile photo" />
              <AvatarFallback class="bg-primary/10 text-xl font-semibold text-primary">
                {{ initials }}
              </AvatarFallback>
            </Avatar>

            <button
              type="button"
              class="absolute inset-0 flex cursor-pointer items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              :disabled="isUploadingAvatar"
              aria-label="Upload profile photo"
              @click="triggerFileInput"
            >
              <LoaderCircle v-if="isUploadingAvatar" class="size-5 animate-spin text-white" />
              <Camera v-else class="size-5 text-white" />
            </button>

            <input
              ref="fileInputRef"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              class="sr-only"
              aria-hidden="true"
              @change="handleFileChange"
            />
          </div>

          <!-- Identity text -->
          <div class="flex flex-col items-center gap-1.5 text-center sm:items-start sm:text-left">
            <div class="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <span class="text-lg font-semibold leading-tight">
                {{ user?.name ?? 'Unnamed User' }}
              </span>
              <Badge v-if="currentRole" variant="secondary" class="text-xs capitalize">
                {{ currentRole }}
              </Badge>
            </div>
            <span class="text-sm text-muted-foreground">{{ user?.email }}</span>
            <p class="mt-0.5 text-xs text-muted-foreground">
              Click your avatar to upload a new photo. JPG, PNG, or WebP up to 2 MB.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>

    <Tabs default-value="profile">
      <TabsList>
        <TabsTrigger value="profile" class="gap-1.5">
          <User class="size-3.5" />
          Profile
        </TabsTrigger>
        <TabsTrigger value="password" class="gap-1.5">
          <Lock class="size-3.5" />
          Password
        </TabsTrigger>
        <TabsTrigger v-if="isDoctor" value="credentials" class="gap-1.5">
          <Stethoscope class="size-3.5" />
          Credentials
        </TabsTrigger>
      </TabsList>

      <TabsContent value="profile" class="mt-4">
        <ProfileForm />
      </TabsContent>

      <TabsContent value="password" class="mt-4">
        <PasswordForm />
      </TabsContent>

      <TabsContent v-if="isDoctor" value="credentials" class="mt-4">
        <CredentialsForm />
      </TabsContent>
    </Tabs>
  </div>
</template>
