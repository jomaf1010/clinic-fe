<script lang="ts">
let scriptPromise: Promise<void> | null = null
let googleIdentityInitialized = false
let activeCredentialCallback: ((response: GoogleCredentialResponse) => void) | null = null

function initializeGoogleIdentity(clientId: string): void {
  if (googleIdentityInitialized || !window.google?.accounts?.id) {
    return
  }

  window.google.accounts.id.initialize({
    client_id: clientId,
    callback: (response) => activeCredentialCallback?.(response),
  })
  googleIdentityInitialized = true
}

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
</script>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  disabled?: boolean
  shape?: 'rectangular' | 'pill' | 'circle' | 'square'
  text?: 'signin_with' | 'signup_with' | 'continue_with'
  width?: number
}>(), {
  disabled: false,
  shape: 'rectangular',
  text: 'continue_with',
  width: 400,
})

const emit = defineEmits<{
  credential: [credential: string]
}>()

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
const containerRef = ref<HTMLElement | null>(null)
const buttonRef = ref<HTMLElement | null>(null)
const ready = ref(false)
const handleCredential = (response: GoogleCredentialResponse) => {
  if (response.credential) {
    emit('credential', response.credential)
  }
}

let resizeObserver: ResizeObserver | null = null

async function renderButton(): Promise<void> {
  if (!clientId || !buttonRef.value || props.disabled) {
    ready.value = false
    if (activeCredentialCallback === handleCredential) {
      activeCredentialCallback = null
    }
    return
  }

  await loadGoogleIdentityScript()
  await nextTick()

  if (!window.google?.accounts?.id || !buttonRef.value) {
    return
  }

  activeCredentialCallback = handleCredential
  initializeGoogleIdentity(clientId)

  buttonRef.value.innerHTML = ''
  window.google.accounts.id.renderButton(buttonRef.value, {
    theme: 'outline',
    size: 'large',
    type: 'standard',
    text: props.text,
    shape: props.shape,
    width: Math.floor(containerRef.value?.clientWidth ?? props.width ?? 320),
  })
  ready.value = true
}

onMounted(() => {
  renderButton().catch(() => {
    ready.value = false
  })

  if (containerRef.value) {
    resizeObserver = new ResizeObserver(() => {
      renderButton().catch(() => {
        ready.value = false
      })
    })
    resizeObserver.observe(containerRef.value)
  }
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  if (activeCredentialCallback === handleCredential) {
    activeCredentialCallback = null
  }
})

watch(() => [props.disabled, props.shape, props.text, props.width], () => {
  renderButton().catch(() => {
    ready.value = false
  })
})
</script>

<template>
  <div v-if="clientId" ref="containerRef" class="flex min-h-10 w-full justify-center">
    <div ref="buttonRef" class="google-button-frame" :class="{ 'pointer-events-none opacity-60': disabled || !ready }" />
  </div>
</template>

<style scoped>
.google-button-frame {
  overflow: hidden;
  border-radius: 9999px;
  box-shadow: 0 10px 24px rgb(15 23 42 / 0.05);
}
</style>
