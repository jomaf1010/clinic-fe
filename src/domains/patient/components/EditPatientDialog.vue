<script setup lang="ts">
import { ref, watch } from 'vue'
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
  ShieldAlert,
  HeartPulse,
  StickyNote,
  CheckCircle2,
} from 'lucide-vue-next'
import DateOfBirthPicker from '@/components/DateOfBirthPicker.vue'
import TagInput from '@/components/TagInput.vue'
import { patientApi } from '../api/patientApi'
import { HttpError } from '@/lib/http'
import { editPatientSchema } from '@/lib/validationRules'
import type { PatientResponse } from '../types/patient.types'
import type { ValidationError } from '@/domains/auth/types/auth.types'

const props = defineProps<{
  open: boolean
  patient: PatientResponse
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  updated: []
}>()

const { handleSubmit, setFieldError, resetForm, setValues } = useForm({
  validationSchema: editPatientSchema,
})

const { value: fullName, errorMessage: fullNameError } = useField<string>('full_name')
const { value: address, errorMessage: addressError } = useField<string>('address')
const { value: dateOfBirth, errorMessage: dateOfBirthError } = useField<string>('date_of_birth')
const { value: sex, errorMessage: sexError } = useField<string>('sex')
const { value: contactNumber, errorMessage: contactNumberError } = useField<string>('contact_number')
const { value: email, errorMessage: emailError } = useField<string>('email')
const { value: note, errorMessage: noteError } = useField<string>('note')

const allergies = ref<string[]>([])
const chronicConditions = ref<string[]>([])

const isLoading = ref(false)
const generalError = ref<string | null>(null)

function populateForm() {
  setValues({
    full_name: props.patient.full_name,
    address: props.patient.address,
    date_of_birth: props.patient.date_of_birth,
    sex: props.patient.sex,
    contact_number: props.patient.contact_number ?? '',
    email: props.patient.email ?? '',
    note: props.patient.note ?? '',
  })
  allergies.value = [...props.patient.allergies]
  chronicConditions.value = [...props.patient.chronic_conditions]
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      generalError.value = null
      populateForm()
    }
  },
)

const onSubmit = handleSubmit(async (values) => {
  generalError.value = null
  isLoading.value = true

  try {
    await patientApi.update(props.patient.id, {
      full_name: values.full_name,
      address: values.address,
      date_of_birth: values.date_of_birth,
      sex: values.sex,
      contact_number: values.contact_number || null,
      email: values.email || null,
      allergies: allergies.value,
      chronic_conditions: chronicConditions.value,
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

        for (const [field, messages] of Object.entries(serverErrors)) {
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

        <!-- Basic Information -->
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div class="flex flex-col gap-2">
            <Label for="edit_full_name" class="flex items-center gap-1.5">
              <User class="size-3.5 text-muted-foreground" />
              Full name
            </Label>
            <Input
              id="edit_full_name"
              v-model="fullName"
              type="text"
              placeholder="Juan Dela Cruz"
              :disabled="isLoading"
              :aria-invalid="!!fullNameError"
              required
            />
            <p v-if="fullNameError" class="text-xs text-destructive">{{ fullNameError }}</p>
          </div>

          <div class="flex flex-col gap-2">
            <Label for="edit_address" class="flex items-center gap-1.5">
              <MapPin class="size-3.5 text-muted-foreground" />
              Address
            </Label>
            <Input
              id="edit_address"
              v-model="address"
              type="text"
              placeholder="123 Main St, Quezon City"
              :disabled="isLoading"
              :aria-invalid="!!addressError"
              required
            />
            <p v-if="addressError" class="text-xs text-destructive">{{ addressError }}</p>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div class="flex flex-col gap-2">
            <Label class="flex items-center gap-1.5">
              <CalendarDays class="size-3.5 text-muted-foreground" />
              Date of birth
            </Label>
            <DateOfBirthPicker v-model="dateOfBirth" />
            <p v-if="dateOfBirthError" class="text-xs text-destructive">{{ dateOfBirthError }}</p>
          </div>

          <div class="flex flex-col gap-2">
            <Label for="edit_sex" class="flex items-center gap-1.5">
              <User class="size-3.5 text-muted-foreground" />
              Gender
            </Label>
            <Select v-model="sex">
              <SelectTrigger :aria-invalid="!!sexError">
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
              </SelectContent>
            </Select>
            <p v-if="sexError" class="text-xs text-destructive">{{ sexError }}</p>
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
              v-model="contactNumber"
              type="tel"
              placeholder="09171234567"
              :disabled="isLoading"
              :aria-invalid="!!contactNumberError"
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

        <Separator />

        <!-- Additional Information -->
        <div class="flex flex-col gap-2">
          <Label class="flex items-center gap-1.5">
            <ShieldAlert class="size-3.5 text-muted-foreground" />
            Allergies <span class="text-muted-foreground">(optional)</span>
          </Label>
          <TagInput
            v-model="allergies"
            :search-fn="patientApi.searchAllergies"
            placeholder="Type allergy and press Enter..."
          />
        </div>

        <div class="flex flex-col gap-2">
          <Label class="flex items-center gap-1.5">
            <HeartPulse class="size-3.5 text-muted-foreground" />
            Chronic conditions <span class="text-muted-foreground">(optional)</span>
          </Label>
          <TagInput
            v-model="chronicConditions"
            :search-fn="patientApi.searchConditions"
            placeholder="Type condition and press Enter..."
          />
        </div>

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
