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
import AddressForm from '@/components/AddressForm.vue'
import NameForm from '@/components/NameForm.vue'
import { patientApi } from '../api/patientApi'
import { HttpError } from '@/lib/http'
import { createPatientSchema } from '@/lib/validationRules'
import { useFormDraft } from '@/composables/useFormDraft'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import type { ValidationError } from '@/domains/auth/types/auth.types'
import type { PatientAddress, PatientName } from '../types/patient.types'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  created: []
}>()

const { handleSubmit, setFieldError, resetForm } = useForm({
  validationSchema: createPatientSchema,
})

const { value: dateOfBirth, errorMessage: dateOfBirthError } = useField<string>('date_of_birth')
const { value: sex, errorMessage: sexError } = useField<string>('sex')
const { value: contactNumber, errorMessage: contactNumberError } = useField<string>('contact_number')
const { value: email, errorMessage: emailError } = useField<string>('email')
const { value: note, errorMessage: noteError } = useField<string>('note')

const authStore = useAuthStore()
const clinicAddress = authStore.currentClinic?.address
const addressPrefill = clinicAddress?.region_code && clinicAddress?.province_code && clinicAddress?.city_code
  ? { region_code: clinicAddress.region_code, province_code: clinicAddress.province_code, city_code: clinicAddress.city_code }
  : null

const name = ref<PatientName | null>(null)
const address = ref<PatientAddress | null>(null)
const allergies = ref<string[]>([])
const chronicConditions = ref<string[]>([])

const isLoading = ref(false)
const generalError = ref<string | null>(null)

const { clearDraft } = useFormDraft(
  'create-patient',
  {
    date_of_birth: dateOfBirth,
    sex,
    contact_number: contactNumber,
    email,
    note,
  },
  {
    allergies,
    chronic_conditions: chronicConditions,
  },
)

watch(
  () => props.open,
  (open) => {
    if (open) {
      generalError.value = null
    }
  },
)

const onSubmit = handleSubmit(async (values) => {
  generalError.value = null

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
    await patientApi.create({
      first_name: name.value.first_name,
      middle_name: name.value.middle_name,
      last_name: name.value.last_name,
      suffix: name.value.suffix,
      address: address.value,
      date_of_birth: values.date_of_birth,
      sex: values.sex,
      ...(values.contact_number ? { contact_number: values.contact_number } : {}),
      ...(values.email ? { email: values.email } : {}),
      ...(allergies.value.length > 0 ? { allergies: allergies.value } : {}),
      ...(chronicConditions.value.length > 0 ? { chronic_conditions: chronicConditions.value } : {}),
      ...(values.note ? { note: values.note } : {}),
    })

    clearDraft()
    resetForm()
    name.value = null
    address.value = null
    allergies.value = []
    chronicConditions.value = []
    emit('created')
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
        <DialogTitle>Add Patient</DialogTitle>
        <DialogDescription>Register a new patient in the clinic.</DialogDescription>
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
            <DateOfBirthPicker v-model="dateOfBirth" />
            <p v-if="dateOfBirthError" class="text-xs text-destructive">{{ dateOfBirthError }}</p>
          </div>

          <div class="flex flex-col gap-2">
            <Label for="dlg_sex" class="flex items-center gap-1.5">
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

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div class="flex flex-col gap-2">
            <Label for="dlg_contact_number" class="flex items-center gap-1.5">
              <Phone class="size-3.5 text-muted-foreground" />
              Contact number <span class="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="dlg_contact_number"
              v-model="contactNumber"
              type="tel"
              placeholder="09171234567"
              :disabled="isLoading"
              :aria-invalid="!!contactNumberError"
            />
            <p v-if="contactNumberError" class="text-xs text-destructive">{{ contactNumberError }}</p>
          </div>

          <div class="flex flex-col gap-2">
            <Label for="dlg_email" class="flex items-center gap-1.5">
              <Mail class="size-3.5 text-muted-foreground" />
              Email <span class="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="dlg_email"
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
          <AddressForm v-model="address" :disabled="isLoading" :prefill="addressPrefill" />
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
          <Label for="dlg_note" class="flex items-center gap-1.5">
            <StickyNote class="size-3.5 text-muted-foreground" />
            Note <span class="text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id="dlg_note"
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
            {{ isLoading ? 'Saving...' : 'Save Patient' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
