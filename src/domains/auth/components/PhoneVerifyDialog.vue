<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useForm, useField } from 'vee-validate'
import { toast } from 'vue-sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { OtpInput } from '@/components/ui/otp-input'
import { LoaderCircle, Phone, ShieldCheck, MailWarning } from 'lucide-vue-next'
import { HttpError } from '@/lib/http'
import { phoneNumberPH, formatPHMobile } from '@/lib/validationRules'
import { useAuthStore } from '../stores/authStore'
import { phoneVerificationApi, type ConfirmErrorCode } from '../api/phoneVerificationApi'
import type { ValidationError } from '../types/auth.types'

interface Props {
  open: boolean
  mode: 'add' | 'change'
  currentPhone?: string | null
}

const props = withDefaults(defineProps<Props>(), {
  currentPhone: null,
})

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'success'): void
}>()

const authStore = useAuthStore()

type Step = 'phone' | 'code' | 'success'

const step = ref<Step>('phone')

// Step 1 — phone form
const phoneFieldValidator = phoneNumberPH('Phone number')
const phoneSchema = {
  phone: (value: unknown): true | string => {
    if (typeof value !== 'string' || value.trim() === '') return 'Phone number is required.'
    return phoneFieldValidator(value)
  },
}

const { handleSubmit: handlePhoneSubmit, setFieldError: setPhoneFieldError, resetForm: resetPhoneForm } = useForm({
  validationSchema: phoneSchema,
  initialValues: { phone: props.currentPhone ?? '' },
})

const { value: phoneValue, errorMessage: phoneError } = useField<string>('phone')

const phoneModel = computed<string>({
  get: () => phoneValue.value ?? '',
  set: (val) => { phoneValue.value = formatPHMobile(String(val ?? '')) },
})

function onPhonePaste(e: ClipboardEvent): void {
  e.preventDefault()
  phoneValue.value = formatPHMobile(e.clipboardData?.getData('text') ?? '')
}

// Step 2 — code state
const phoneMasked = ref<string>('')
const expiresAt = ref<string | null>(null)
const code = ref<string>('')
const codeError = ref<string | null>(null)
const codeErrorCode = ref<ConfirmErrorCode | null>(null)

const requestLoading = ref(false)
const confirmLoading = ref(false)

// Countdown
const now = ref<number>(Date.now())
let tickHandle: ReturnType<typeof setInterval> | null = null

function startTicking(): void {
  stopTicking()
  now.value = Date.now()
  tickHandle = setInterval(() => {
    now.value = Date.now()
  }, 1000)
}

function stopTicking(): void {
  if (tickHandle !== null) {
    clearInterval(tickHandle)
    tickHandle = null
  }
}

onBeforeUnmount(stopTicking)

const remainingMs = computed<number>(() => {
  if (!expiresAt.value) return 0
  return Math.max(0, new Date(expiresAt.value).getTime() - now.value)
})

const remainingDisplay = computed<string>(() => {
  const total = Math.ceil(remainingMs.value / 1000)
  const mm = Math.floor(total / 60).toString().padStart(2, '0')
  const ss = (total % 60).toString().padStart(2, '0')
  return `${mm}:${ss}`
})

const isExpired = computed<boolean>(() => remainingMs.value <= 0)

const resendCooldown = ref<number>(0)
let resendHandle: ReturnType<typeof setInterval> | null = null

function startResendCooldown(seconds: number): void {
  resendCooldown.value = seconds
  if (resendHandle !== null) clearInterval(resendHandle)
  resendHandle = setInterval(() => {
    resendCooldown.value -= 1
    if (resendCooldown.value <= 0) {
      if (resendHandle !== null) {
        clearInterval(resendHandle)
        resendHandle = null
      }
    }
  }, 1000)
}

onBeforeUnmount(() => {
  if (resendHandle !== null) clearInterval(resendHandle)
})

const canResend = computed<boolean>(() => isExpired.value || resendCooldown.value <= 0)

// Reset when reopened
watch(
  () => props.open,
  (o) => {
    if (o) {
      step.value = 'phone'
      code.value = ''
      codeError.value = null
      codeErrorCode.value = null
      phoneMasked.value = ''
      expiresAt.value = null
      resendCooldown.value = 0
      resetPhoneForm({ values: { phone: props.currentPhone ?? '' } })
    } else {
      stopTicking()
    }
  },
)

function closeDialog(): void {
  emit('update:open', false)
}

function backToPhone(): void {
  step.value = 'phone'
  code.value = ''
  codeError.value = null
  codeErrorCode.value = null
  stopTicking()
}

const onSubmitPhone = handlePhoneSubmit(async (values) => {
  if (requestLoading.value) return
  requestLoading.value = true
  try {
    const response = await phoneVerificationApi.requestCode(values.phone)
    phoneMasked.value = response.phone_masked
    expiresAt.value = response.expires_at
    step.value = 'code'
    code.value = ''
    codeError.value = null
    codeErrorCode.value = null
    startTicking()
    startResendCooldown(30)
  } catch (err) {
    if (err instanceof HttpError) {
      if (err.status === 422) {
        const body = err.data as ValidationError | undefined
        const fieldMsg = body?.errors?.phone?.[0]
        if (fieldMsg) {
          setPhoneFieldError('phone', fieldMsg)
        } else if (body?.message) {
          setPhoneFieldError('phone', body.message)
        } else {
          setPhoneFieldError('phone', 'Validation failed.')
        }
      } else if (err.status === 429) {
        toast.error('Too many requests. Please try again in an hour.')
      } else if (err.status === 503) {
        toast.error('SMS service is unavailable. Please try again later.')
      } else {
        toast.error('An unexpected error occurred. Please try again.')
      }
    } else {
      toast.error('An unexpected error occurred. Please try again.')
    }
  } finally {
    requestLoading.value = false
  }
})

async function resendCode(): Promise<void> {
  if (requestLoading.value) return
  if (!canResend.value && !isExpired.value) return
  if (!phoneValue.value) return
  requestLoading.value = true
  try {
    const response = await phoneVerificationApi.requestCode(phoneValue.value)
    phoneMasked.value = response.phone_masked
    expiresAt.value = response.expires_at
    code.value = ''
    codeError.value = null
    codeErrorCode.value = null
    startTicking()
    startResendCooldown(30)
    toast.success('A new code has been sent.')
  } catch (err) {
    if (err instanceof HttpError) {
      if (err.status === 429) {
        toast.error('Too many requests. Please try again in an hour.')
      } else if (err.status === 503) {
        toast.error('SMS service is unavailable. Please try again later.')
      } else {
        toast.error('An unexpected error occurred. Please try again.')
      }
    } else {
      toast.error('An unexpected error occurred. Please try again.')
    }
  } finally {
    requestLoading.value = false
  }
}

async function onCodeComplete(value: string): Promise<void> {
  if (confirmLoading.value) return
  codeError.value = null
  codeErrorCode.value = null
  confirmLoading.value = true
  try {
    const response = await phoneVerificationApi.confirmCode(value)
    authStore.setUser(response.user)
    stopTicking()
    step.value = 'success'
    setTimeout(() => {
      emit('success')
      emit('update:open', false)
    }, 1500)
  } catch (err) {
    if (err instanceof HttpError && err.status === 422) {
      const body = err.data as { error?: ConfirmErrorCode; message?: string } | undefined
      const errCode = body?.error ?? null
      codeErrorCode.value = errCode
      if (errCode === 'invalid_code') {
        codeError.value = 'That code is incorrect. Please try again.'
        code.value = ''
      } else if (errCode === 'expired') {
        codeError.value = 'This code has expired. Tap Resend.'
      } else if (errCode === 'too_many_attempts') {
        codeError.value = 'Too many attempts. Request a new code.'
      } else {
        codeError.value = body?.message ?? 'Verification failed.'
      }
    } else {
      codeError.value = 'An unexpected error occurred. Please try again.'
    }
  } finally {
    confirmLoading.value = false
  }
}

const headerTitle = computed<string>(() => {
  if (step.value === 'success') return 'Phone verified'
  if (step.value === 'code') return 'Enter the code'
  return props.mode === 'change' ? 'Change phone number' : 'Add phone number'
})

const headerDescription = computed<string>(() => {
  if (step.value === 'success') return 'Your phone number has been verified successfully.'
  if (step.value === 'code') return `We sent a 6-digit code to ${phoneMasked.value}.`
  return 'We will send a 6-digit verification code via SMS.'
})
</script>

<template>
  <Dialog :open="open" @update:open="(v: boolean) => emit('update:open', v)">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <ShieldCheck v-if="step === 'success'" class="size-5 text-emerald-500" />
          <Phone v-else class="size-5" />
          {{ headerTitle }}
        </DialogTitle>
        <DialogDescription>{{ headerDescription }}</DialogDescription>
      </DialogHeader>

      <!-- Step 1: Phone -->
      <form v-if="step === 'phone'" class="flex flex-col gap-4" novalidate @submit.prevent="onSubmitPhone">
        <div class="flex flex-col gap-2">
          <Label for="phone-verify-input" class="flex items-center gap-1.5">
            <Phone class="size-3.5 text-muted-foreground" />
            Mobile number
          </Label>
          <Input
            id="phone-verify-input"
            v-model="phoneModel"
            type="tel"
            inputmode="numeric"
            autocomplete="tel"
            maxlength="11"
            placeholder="09XXXXXXXXX"
            :disabled="requestLoading"
            :aria-invalid="!!phoneError"
            @paste="onPhonePaste"
          />
          <p v-if="phoneError" class="text-xs text-destructive">{{ phoneError }}</p>
          <p v-else class="text-xs text-muted-foreground">Philippine mobile (09XXXXXXXXX or +639XXXXXXXXX).</p>
        </div>

        <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2">
          <Button type="button" variant="outline" :disabled="requestLoading" @click="closeDialog">Cancel</Button>
          <Button type="submit" :disabled="requestLoading">
            <LoaderCircle v-if="requestLoading" class="size-3.5 animate-spin" />
            Send code
          </Button>
        </div>
      </form>

      <!-- Step 2: Code -->
      <div v-else-if="step === 'code'" class="flex flex-col gap-4">
        <OtpInput
          :value="code"
          :disabled="confirmLoading"
          :invalid="codeErrorCode === 'invalid_code'"
          autofocus
          @update:value="(v: string) => (code = v)"
          @complete="onCodeComplete"
        />

        <div v-if="codeError" role="alert" class="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          <MailWarning class="mt-0.5 size-4 shrink-0" />
          <span>{{ codeError }}</span>
        </div>

        <div class="flex items-center justify-between text-xs text-muted-foreground">
          <span v-if="!isExpired">Expires in {{ remainingDisplay }}</span>
          <span v-else class="text-destructive">Code expired</span>
          <span v-if="confirmLoading" class="flex items-center gap-1">
            <LoaderCircle class="size-3.5 animate-spin" />
            Verifying...
          </span>
        </div>

        <div class="flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            class="text-sm text-primary underline-offset-4 hover:underline disabled:opacity-50"
            :disabled="requestLoading || confirmLoading"
            @click="backToPhone"
          >
            Use a different number
          </button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            :disabled="!canResend || requestLoading || confirmLoading"
            @click="resendCode"
          >
            <LoaderCircle v-if="requestLoading" class="size-3.5 animate-spin" />
            {{ canResend ? 'Resend code' : `Resend in ${resendCooldown}s` }}
          </Button>
        </div>
      </div>

      <!-- Step 3: Success -->
      <div v-else class="flex flex-col items-center gap-3 py-4 text-center">
        <div class="flex size-14 items-center justify-center rounded-full bg-emerald-500/10">
          <ShieldCheck class="size-7 text-emerald-500" />
        </div>
        <p class="text-sm font-medium">Your phone number is verified.</p>
      </div>
    </DialogContent>
  </Dialog>
</template>
