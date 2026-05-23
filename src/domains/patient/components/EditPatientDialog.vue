<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useForm, useField } from 'vee-validate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  User,
  MapPin,
  CalendarDays,
  Phone,
  Mail,
  LoaderCircle,
  StickyNote,
  CheckCircle2,
} from 'lucide-vue-next'
import DateOfBirthPicker from '@/components/DateOfBirthPicker.vue'
import AddressForm from '@/components/AddressForm.vue'
import NameForm from '@/components/NameForm.vue'
import { patientApi } from '../api/patientApi'
import { HttpError } from '@/lib/http'
import { editPatientSchema, validateRuleSchema, formatPHMobile } from '@/lib/validationRules'
import type { PatientResponse, PatientAddress, PatientName } from '../types/patient.types'
import type { ValidationError } from '@/domains/auth/types/auth.types'

const props = defineProps<{
  open: boolean
  patient: PatientResponse
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  updated: []
}>()

const { handleSubmit, setFieldError, resetForm, setValues } = useForm<EditPatientFormValues>()

const { value: dateOfBirth, errorMessage: dateOfBirthError } = useField<string>('date_of_birth')
const { value: sex, errorMessage: sexError } = useField<string>('sex')
const { value: contactNumber, errorMessage: contactNumberError } = useField<string>('contact_number')
const { value: email, errorMessage: emailError } = useField<string>('email')
const { value: note, errorMessage: noteError } = useField<string>('note')

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const

const name = ref<PatientName | null>(null)
const address = ref<PatientAddress | null>(null)
const bloodType = ref<string>('')

const isLoading = ref(false)
const generalError = ref<string | null>(null)

type EditPatientFormValues = {
  date_of_birth: string
  sex: string
  contact_number: string
  email: string
  note: string
}

function populateForm() {
  setValues({
    date_of_birth: props.patient.date_of_birth,
    sex: props.patient.sex,
    contact_number: props.patient.contact_number ?? '',
    email: props.patient.email ?? '',
    note: props.patient.note ?? '',
  })
  name.value = {
    first_name: props.patient.first_name,
    middle_name: props.patient.middle_name,
    last_name: props.patient.last_name,
    suffix: props.patient.suffix,
  }
  address.value = props.patient.address
  bloodType.value = props.patient.blood_type ?? ''
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      generalError.value = null
      populateForm()
    }
  },
  { immediate: true },
)

const contactNumberModel = computed<string>({
  get: () => contactNumber.value ?? '',
  set: (val) => { contactNumber.value = formatPHMobile(String(val ?? '')) },
})

function onContactNumberPaste(e: ClipboardEvent): void {
  e.preventDefault()
  contactNumber.value = formatPHMobile(e.clipboardData?.getData('text') ?? '')
}

const onSubmit = handleSubmit(async (values) => {
  generalError.value = null

  const validationErrors = validateRuleSchema(editPatientSchema, {
    date_of_birth: values.date_of_birth,
    sex: values.sex,
    contact_number: values.contact_number,
    email: values.email,
    note: values.note,
  })
  if (Object.keys(validationErrors).length > 0) {
    for (const field of Object.keys(validationErrors) as (keyof EditPatientFormValues)[]) {
      setFieldError(field, validationErrors[field])
    }
    return
  }

  if (!name.value?.first_name || !name.value?.last_name) {
    generalError.value = 'Please enter first and last name.'
    return
  }

  if (!address.value) {
    generalError.value = 'Please complete the address fields.'
    return
  }

  isLoading.value = true

  try {
    await patientApi.update(props.patient.id, {
      first_name: name.value.first_name,
      middle_name: name.value.middle_name,
      last_name: name.value.last_name,
      suffix: name.value.suffix,
      address: address.value,
      date_of_birth: values.date_of_birth,
      sex: values.sex,
      blood_type: bloodType.value || null,
      contact_number: values.contact_number || null,
      email: values.email || null,
      note: values.note || null,
    })

    resetForm()
    emit('updated')
    emit('update:open', false)
  } catch (err) {
    if (err instanceof HttpError) {
      if (err.status === 422) {
        const body = err.data as ValidationError
        const serverErrors = body.errors ?? {}

        for (const [field, messages] of Object.entries(serverErrors) as [keyof EditPatientFormValues, string[]][]) {
          setFieldError(field, messages[0])
        }

        generalError.value = body.message ?? 'Validation failed.'
      } else {
        generalError.value = 'An unexpected error occurred. Please try again.'
      }
    } else {
      generalError.value = 'Unable to connect to the server. Please try again.'
    }
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <Dialog :open="open" @update:open="(val) => emit('update:open', val)">
    <DialogContent class="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Edit Patient</DialogTitle>
        <DialogDescription>Update patient profile information.</DialogDescription>
      </DialogHeader>

      <form class="flex flex-col gap-4" novalidate @submit.prevent="onSubmit">
        <div
          v-if="generalError"
          role="alert"
          class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
        >
          {{ generalError }}
        </div>

        <!-- Patient Name (full width) -->
        <div>
          <Label class="mb-2 flex items-center gap-1.5">
            <User class="size-3.5 text-muted-foreground" />
            Patient Name
          </Label>
          <NameForm v-model="name" :disabled="isLoading" />
        </div>

        <!-- DOB / Sex -->
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div class="flex flex-col gap-2">
            <Label class="flex items-center gap-1.5">
              <CalendarDays class="size-3.5 text-muted-foreground" />
              Date of birth
            </Label>
            <DateOfBirthPicker v-model="dateOfBirth" :invalid="!!dateOfBirthError" />
            <p v-if="dateOfBirthError" class="text-xs text-destructive">{{ dateOfBirthError }}</p>
          </div>

          <div class="flex flex-col gap-2">
            <Label for="edit_sex" class="flex items-center gap-1.5">
              <User class="size-3.5 text-muted-foreground" />
              Sex
            </Label>
            <Select v-model="sex">
              <SelectTrigger :aria-invalid="!!sexError">
                <SelectValue placeholder="Select sex" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
              </SelectContent>
            </Select>
            <p v-if="sexError" class="text-xs text-destructive">{{ sexError }}</p>
          </div>
        </div>

        <!-- Blood Type -->
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div class="flex flex-col gap-2">
            <Label for="edit_blood_type" class="flex items-center gap-1.5">
              <User class="size-3.5 text-muted-foreground" />
              Blood type <span class="text-muted-foreground">(optional)</span>
            </Label>
            <Select v-model="bloodType">
              <SelectTrigger id="edit_blood_type">
                <SelectValue placeholder="Select blood type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="bt in BLOOD_TYPES" :key="bt" :value="bt">
                  {{ bt }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div class="flex flex-col gap-2">
            <Label for="edit_contact_number" class="flex items-center gap-1.5">
              <Phone class="size-3.5 text-muted-foreground" />
              Contact number <span class="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="edit_contact_number"
              v-model="contactNumberModel"
              type="tel"
              inputmode="numeric"
              autocomplete="tel"
              maxlength="11"
              placeholder="09171234567"
              :disabled="isLoading"
              :aria-invalid="!!contactNumberError"
              @paste="onContactNumberPaste"
            />
            <p v-if="contactNumberError" class="text-xs text-destructive">{{ contactNumberError }}</p>
          </div>

          <div class="flex flex-col gap-2">
            <Label for="edit_email" class="flex items-center gap-1.5">
              <Mail class="size-3.5 text-muted-foreground" />
              Email <span class="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="edit_email"
              v-model="email"
              type="email"
              placeholder="patient@email.com"
              :disabled="isLoading"
              :aria-invalid="!!emailError"
            />
            <p v-if="emailError" class="text-xs text-destructive">{{ emailError }}</p>
          </div>
        </div>

        <!-- Address -->
        <div>
          <Label class="mb-2 flex items-center gap-1.5">
            <MapPin class="size-3.5 text-muted-foreground" />
            Address
          </Label>
          <AddressForm v-model="address" :disabled="isLoading" />
        </div>

        <Separator />

        <div class="flex flex-col gap-2">
          <Label for="edit_note" class="flex items-center gap-1.5">
            <StickyNote class="size-3.5 text-muted-foreground" />
            Note <span class="text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id="edit_note"
            v-model="note"
            placeholder="Any additional notes about the patient..."
            :disabled="isLoading"
            :aria-invalid="!!noteError"
            rows="3"
          />
          <p v-if="noteError" class="text-xs text-destructive">{{ noteError }}</p>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" :disabled="isLoading" @click="emit('update:open', false)">
            Cancel
          </Button>
          <Button type="submit" :disabled="isLoading">
            <LoaderCircle v-if="isLoading" class="size-3.5 animate-spin" />
            <CheckCircle2 v-else class="size-3.5" />
            {{ isLoading ? 'Saving...' : 'Save Changes' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
