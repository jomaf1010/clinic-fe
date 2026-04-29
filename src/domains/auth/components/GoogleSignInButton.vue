<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'

const props = withDefaults(defineProps<{
  disabled?: boolean
  text?: 'signin_with' | 'signup_with' | 'continue_with'
}>(), {
  disabled: false,
  text: 'continue_with',
})

const emit = defineEmits<{
  credential: [credential: string]
}>()

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
const buttonRef = ref<HTMLElement | null>(null)
const ready = ref(false)

let scriptPromise: Promise<void> | null = null

function loadGoogleIdentityScript(): Promise<void> {
  if (window.google?.accounts?.id) {
    return Promise.resolve()
  }

  if (scriptPromise) {
    return scriptPromise
  }

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]')
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Google sign-in failed to load.')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Google sign-in failed to load.'))
    document.head.appendChild(script)
  })

  return scriptPromise
}

async function renderButton(): Promise<void> {
  if (!clientId || !buttonRef.value || props.disabled) {
    return
  }

  await loadGoogleIdentityScript()
  await nextTick()

  if (!window.google?.accounts?.id || !buttonRef.value) {
    return
  }

  buttonRef.value.innerHTML = ''
  window.google.accounts.id.initialize({
    client_id: clientId,
    callback: (response) => {
      if (response.credential) {
        emit('credential', response.credential)
      }
    },
  })
  window.google.accounts.id.renderButton(buttonRef.value, {
    theme: 'outline',
    size: 'large',
    type: 'standard',
    text: props.text,
    shape: 'rectangular',
    width: 320,
  })
  ready.value = true
}

onMounted(() => {
  renderButton().catch(() => {
    ready.value = false
  })
})
</script>

<template>
  <div v-if="clientId" class="flex min-h-11 justify-center">
    <div ref="buttonRef" :class="{ 'pointer-events-none opacity-60': disabled || !ready }" />
  </div>
</template>
