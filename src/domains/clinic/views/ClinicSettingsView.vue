<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { FileText, Receipt, LoaderCircle, Banknote, Stethoscope } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { clinicApi } from '@/domains/clinic/api/clinicApi'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import type { ToothNumberingPreference } from '@/domains/auth/types/auth.types'
import DentalBillingTab from '@/domains/dental/components/DentalBillingTab.vue'

const authStore = useAuthStore()
const isFetching = ref(true)
const isSaving = ref(false)

const autoGeneratePdf = ref(true)
const prescriptionQtyMode = ref<'absolute' | 'adjusted'>('absolute')
const autoRegenOnQtyChange = ref(true)
const suppliesAsClinicRevenue = ref(true)
const defaultConsultationFee = ref('')
const defaultFollowUpFee = ref('')

// ── Specialties ────────────────────────────────────────────────────
// One tab per specialty. Future specialties get their own tab + ref +
// hydrate-on-mount line. Tooth numbering is dental-only for now.
const specialtyTab = ref<'dental'>('dental')
const dentalToothNumbering = ref<ToothNumberingPreference>('fdi')

const toothNumberingOptions: { value: ToothNumberingPreference; label: string; full: string }[] = [
  { value: 'fdi',       label: 'FDI',    full: 'FDI / ISO-3950 (international)' },
  { value: 'universal', label: 'US',     full: 'Universal Numbering System (1–32)' },
  { value: 'palmer',    label: 'Palmer', full: 'Palmer notation (UR/UL/LL/LR + position)' },
]

function setToothNumbering(v: ToothNumberingPreference): void {
  if (dentalToothNumbering.value === v) return
  dentalToothNumbering.value = v
  saveSetting('tooth_numbering', v)
}

// Surface specialties dynamically — only render tabs for specialties that
// have at least one wired setting. New specialties append here.
const availableSpecialties = computed<{ value: 'dental'; label: string }[]>(() => [
  { value: 'dental', label: 'Dental' },
])

onMounted(async () => {
  try {
    const res = await clinicApi.show()
    const settings = res.data.settings ?? {}
    autoGeneratePdf.value = settings.auto_generate_prescription_pdf !== false
    prescriptionQtyMode.value = (settings.prescription_quantity_mode as 'absolute' | 'adjusted') ?? 'absolute'
    autoRegenOnQtyChange.value = settings.auto_regenerate_pdf_on_qty_change !== false
    suppliesAsClinicRevenue.value = settings.billing_supplies_as_clinic_revenue !== false
    defaultConsultationFee.value = settings.default_consultation_fee != null ? String(settings.default_consultation_fee) : ''
    defaultFollowUpFee.value = settings.default_follow_up_fee != null ? String(settings.default_follow_up_fee) : ''
    const tn = (settings as { tooth_numbering?: ToothNumberingPreference | null }).tooth_numbering
    dentalToothNumbering.value = tn === 'universal' || tn === 'palmer' ? tn : 'fdi'
  } catch {
    toast.error('Failed to load settings')
  } finally {
    isFetching.value = false
  }
})

async function saveSetting(key: string, value: unknown) {
  isSaving.value = true
  try {
    await clinicApi.update({
      settings: { [key]: value },
    })
    await authStore.fetchUser()
    toast.success('Setting saved')
  } catch {
    toast.error('Failed to save setting')
  } finally {
    isSaving.value = false
  }
}

function toggleAutoGenerate(val: boolean) {
  autoGeneratePdf.value = val
  saveSetting('auto_generate_prescription_pdf', val)
}

function toggleQtyMode(val: boolean) {
  prescriptionQtyMode.value = val ? 'adjusted' : 'absolute'
  saveSetting('prescription_quantity_mode', val ? 'adjusted' : 'absolute')
}

function toggleAutoRegen(val: boolean) {
  autoRegenOnQtyChange.value = val
  saveSetting('auto_regenerate_pdf_on_qty_change', val)
}

function toggleSuppliesRevenue(val: boolean) {
  suppliesAsClinicRevenue.value = val
  saveSetting('billing_supplies_as_clinic_revenue', val)
}

function saveFeeSetting(key: string, value: string) {
  const num = parseFloat(value)
  saveSetting(key, num > 0 ? num : null)
}
</script>

<template>
  <div class="clinic-settings-view flex flex-col gap-5">
    <div v-if="isFetching" class="flex items-center justify-center py-12">
      <LoaderCircle class="size-5 animate-spin text-muted-foreground" />
    </div>

    <template v-else>
      <Card class="clinic-card overflow-hidden rounded-2xl border-0 py-0">
        <CardHeader class="px-5 pt-5 sm:px-6 sm:pt-6">
          <div class="flex items-center gap-2">
            <span class="clinic-section-icon flex size-9 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
              <Receipt class="size-4" />
            </span>
            <CardTitle class="text-base">Billing & Revenue</CardTitle>
          </div>
          <CardDescription>Configure how revenue is attributed between the clinic and doctors</CardDescription>
        </CardHeader>

        <CardContent class="flex flex-col gap-6 px-5 pb-5 sm:px-6 sm:pb-6">
          <div class="clinic-setting-row surface-muted flex items-start gap-4 rounded-2xl p-4">
            <Switch
              :model-value="suppliesAsClinicRevenue"
              :disabled="isSaving"
              class="mt-0.5 shrink-0"
              @update:model-value="toggleSuppliesRevenue"
            />
            <div>
              <Label class="text-sm font-medium">Clinic revenue for medicines, consumables & lab services</Label>
              <p class="mt-0.5 text-xs text-muted-foreground">
                When enabled, revenue from medicines, consumables, and lab services is attributed to the clinic. Only the consultation fee counts as doctor revenue. When disabled, all line items (including medicines, consumables, and lab services) are attributed to the doctor who created the consultation.
              </p>
              <div class="surface-card mt-3 rounded-2xl px-3 py-2 text-xs text-muted-foreground">
                <p class="font-medium">How this affects the doctor's billing view:</p>
                <ul class="mt-1 list-disc pl-4 space-y-0.5">
                  <li><strong>ON:</strong> Doctor's revenue stats show only consultation fees. Invoices are still fully visible with all line items.</li>
                  <li><strong>OFF:</strong> Doctor's revenue stats include all line items (consultation fees + medicines + consumables + lab services).</li>
                </ul>
              </div>
            </div>
          </div>
          <Separator class="opacity-40" />

          <div class="flex flex-col gap-1.5">
            <div class="flex items-center gap-2">
              <Banknote class="size-3.5 text-muted-foreground" />
              <Label class="text-sm font-medium">Default consultation fees</Label>
            </div>
            <p class="text-xs text-muted-foreground">
              Clinic-wide default fees used when a doctor has not set their own fee. Doctors can override these in their account settings.
            </p>
          </div>

          <div class="grid gap-4 sm:grid-cols-3">
            <div class="flex flex-col gap-2">
              <Label for="default-consultation-fee" class="text-xs text-muted-foreground">Consultation Fee</Label>
              <Input
                id="default-consultation-fee"
                v-model="defaultConsultationFee"
                class="h-11 rounded-full px-4"
                type="number"
                placeholder="0.00"
                min="0"
                :disabled="isSaving"
                @blur="saveFeeSetting('default_consultation_fee', defaultConsultationFee)"
              />
            </div>
            <div class="flex flex-col gap-2">
              <Label for="default-followup-fee" class="text-xs text-muted-foreground">Follow-up Fee</Label>
              <Input
                id="default-followup-fee"
                v-model="defaultFollowUpFee"
                class="h-11 rounded-full px-4"
                type="number"
                placeholder="0.00"
                min="0"
                :disabled="isSaving"
                @blur="saveFeeSetting('default_follow_up_fee', defaultFollowUpFee)"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card class="clinic-card overflow-hidden rounded-2xl border-0 py-0">
        <CardHeader class="px-5 pt-5 sm:px-6 sm:pt-6">
          <div class="flex items-center gap-2">
            <span class="clinic-section-icon clinic-section-icon--blue flex size-9 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white">
              <FileText class="size-4" />
            </span>
            <CardTitle class="text-base">Prescription Generation</CardTitle>
          </div>
          <CardDescription>Settings for prescription PDF generation and quantity handling</CardDescription>
        </CardHeader>

        <CardContent class="flex flex-col gap-6 px-5 pb-5 sm:px-6 sm:pb-6">
          <div class="clinic-setting-row surface-muted flex items-start gap-4 rounded-2xl p-4">
            <Switch
              :model-value="autoGeneratePdf"
              :disabled="isSaving"
              class="mt-0.5 shrink-0"
              @update:model-value="toggleAutoGenerate"
            />
            <div>
              <Label class="text-sm font-medium">Auto-generate prescription PDF</Label>
              <p class="mt-0.5 text-xs text-muted-foreground">
                Automatically generate a downloadable prescription PDF when a consultation is finalized. If disabled, doctors must manually generate the PDF from the consultation view.
              </p>
            </div>
          </div>

          <div class="flex flex-col gap-4">
            <div class="clinic-setting-row surface-muted flex items-start gap-4 rounded-2xl p-4">
              <Switch
                :model-value="prescriptionQtyMode === 'adjusted'"
                :disabled="isSaving"
                class="mt-0.5 shrink-0"
                @update:model-value="toggleQtyMode"
              />
              <div>
                <Label class="text-sm font-medium">Auto-deduct purchased quantity from prescription</Label>
                <p class="mt-0.5 text-xs text-muted-foreground">
                  When enabled, the prescription PDF shows only the remaining quantity the patient still needs to purchase. For example, if the doctor prescribed #21 and the patient already bought 14, the PDF will show #7. When disabled, the prescription always shows the full prescribed quantity regardless of what was purchased.
                </p>
              </div>
            </div>

            <div v-if="prescriptionQtyMode === 'adjusted'" class="clinic-setting-row surface-muted ml-0 flex items-start gap-4 rounded-2xl p-4 sm:ml-12">
              <Switch
                :model-value="autoRegenOnQtyChange"
                :disabled="isSaving"
                class="mt-0.5 shrink-0"
                @update:model-value="toggleAutoRegen"
              />
              <div>
                <Label class="text-sm font-medium">Auto-regenerate PDF on quantity change</Label>
                <p class="mt-0.5 text-xs text-muted-foreground">
                  Automatically regenerate the prescription PDF whenever medicine quantities are modified in billing or the consultation payment tab. When disabled, a prompt will ask the user whether to regenerate.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card class="clinic-card overflow-hidden rounded-2xl border-0 py-0">
        <CardHeader class="px-5 pt-5 sm:px-6 sm:pt-6">
          <div class="flex items-center gap-2">
            <span class="clinic-section-icon clinic-section-icon--violet flex size-9 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-violet-600 text-white">
              <Stethoscope class="size-4" />
            </span>
            <CardTitle class="text-base">Specialties</CardTitle>
          </div>
          <CardDescription>
            Clinic-wide defaults per specialty. Individual doctors can override
            most of these on their own profile.
          </CardDescription>
        </CardHeader>

        <CardContent class="px-5 pb-5 sm:px-6 sm:pb-6">
          <Tabs v-model="specialtyTab" class="w-full">
            <TabsList class="clinic-specialty-tabs rounded-full">
              <TabsTrigger
                v-for="s in availableSpecialties"
                :key="s.value"
                :value="s.value"
                class="rounded-full"
              >{{ s.label }}</TabsTrigger>
            </TabsList>

            <TabsContent value="dental" class="mt-4 flex flex-col gap-6">
              <div class="clinic-setting-row surface-muted flex flex-col gap-2 rounded-2xl p-4">
                <Label class="text-sm font-medium">Tooth numbering system</Label>
                <p class="text-xs text-muted-foreground">
                  Display-only — odontogram data is always stored in FDI / ISO-3950
                  regardless of this choice. Staff and doctors who haven't set their
                  own preference will see this default. Dentists can override on their
                  own profile.
                </p>
                <div
                  role="group"
                  aria-label="Tooth numbering system"
                  class="surface-card mt-1 inline-flex w-fit items-center gap-0.5 rounded-full p-1 text-[12px] font-semibold"
                >
                  <button
                    v-for="opt in toothNumberingOptions"
                    :key="opt.value"
                    type="button"
                    :aria-pressed="dentalToothNumbering === opt.value"
                    :title="opt.full"
                    :disabled="isSaving"
                    :class="[
                      'rounded-full px-3 py-1.5 transition focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-wait',
                      dentalToothNumbering === opt.value
                        ? 'bg-gradient-to-br from-blue-600 to-teal-500 text-white shadow-[0_12px_26px_rgba(37,99,235,0.18)]'
                        : 'text-muted-foreground hover:text-foreground',
                    ]"
                    @click="setToothNumbering(opt.value)"
                  >{{ opt.label }}</button>
                </div>
              </div>

              <DentalBillingTab scope="clinic" />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </template>
  </div>
</template>

<style scoped>
.clinic-card {
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.5),
    0 24px 70px -42px rgb(15 23 42 / 0.42);
}

.clinic-section-icon {
  box-shadow:
    0 16px 32px rgb(16 185 129 / 0.22),
    inset 0 1px 0 rgb(255 255 255 / 0.28);
}

.clinic-section-icon--blue {
  box-shadow:
    0 16px 32px rgb(37 99 235 / 0.22),
    inset 0 1px 0 rgb(255 255 255 / 0.28);
}

.clinic-section-icon--violet {
  box-shadow:
    0 16px 32px rgb(139 92 246 / 0.22),
    inset 0 1px 0 rgb(255 255 255 / 0.28);
}

.clinic-setting-row {
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.36);
}

.clinic-specialty-tabs {
  border: 0;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.5),
    0 14px 32px rgb(15 23 42 / 0.08);
}

.clinic-specialty-tabs :deep([data-slot='tabs-trigger'][data-state='active']) {
  color: white;
  background: linear-gradient(135deg, rgb(37 99 235), rgb(20 184 166));
  box-shadow:
    0 14px 30px rgb(37 99 235 / 0.18),
    0 12px 26px rgb(20 184 166 / 0.14),
    inset 0 1px 0 rgb(255 255 255 / 0.24);
}

:global(.dark .clinic-card) {
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.05),
    0 28px 78px -44px rgb(0 0 0 / 0.82);
}

:global(.dark .clinic-setting-row) {
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.05);
}
</style>
