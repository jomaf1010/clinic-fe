<script setup lang="ts">
import { reactive, computed, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, LoaderCircle, ArrowUp, ArrowDown } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RouteNames } from '@/router/routeNames'
import { defaultConsultationSummaryTemplate } from '@/domains/template/types/template.types'
import { templateApi } from '@/domains/template/api/templateApi'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const category = computed(() => route.params.category as string)
const variation = computed(() => route.params.variation as string)

const template = reactive({ ...defaultConsultationSummaryTemplate })
const templateName = ref('Default')
const isLoading = ref(false)
const isSaving = ref(false)

const clinicName = computed(() => authStore.currentClinic?.clinic_name ?? 'Clinic Name')
const clinicAddress = computed(() => authStore.currentClinic?.formatted_address ?? '')
const clinicContact = computed(() => authStore.currentClinic?.contact_number ?? '')
const clinicEmail = computed(() => authStore.currentClinic?.email ?? '')
const clinicLogoUrl = computed(() => authStore.currentClinic?.logo_url ?? null)
const doctorName = computed(() => [authStore.user?.title_prefix, authStore.user?.name].filter(Boolean).join(' ') || 'Doctor Name')
const specialty = computed(() => authStore.user?.specialty ?? '')
const subSpecialty = computed(() => authStore.user?.sub_specialty ?? '')
const prcLicense = computed(() => authStore.user?.prc_license_number ?? '')
const ptrNumber = computed(() => authStore.user?.ptr_number ?? '')
const s2License = computed(() => authStore.user?.s2_license_number ?? '')

function goBack() {
  router.push({ name: RouteNames.CLINIC_TEMPLATES })
}

onMounted(async () => {
  isLoading.value = true
  try {
    const res = await templateApi.show(category.value, variation.value)
    if (res.data) {
      templateName.value = res.data.name
      Object.assign(template, res.data.config)
    }
  } catch {
    // No saved template yet — use defaults
  } finally {
    isLoading.value = false
  }
})

async function save() {
  isSaving.value = true
  try {
    await templateApi.upsert(category.value, variation.value, {
      name: templateName.value,
      config: { ...template },
      is_active: true,
    })
    toast.success('Template saved')
  } catch {
    toast.error('Failed to save template')
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <div class="flex flex-1 flex-col gap-4 pt-4">
    <!-- Header -->
    <div class="flex items-center gap-3">
      <Button variant="ghost" size="icon" class="size-8" @click="goBack">
        <ArrowLeft class="size-4" />
      </Button>
      <div>
        <h1 class="text-lg font-semibold">Edit Consultation Summary Template</h1>
        <p class="text-sm text-muted-foreground">Customize the layout for consultation summaries</p>
      </div>
      <div class="ml-auto flex gap-2">
        <Button variant="outline" @click="goBack" :disabled="isSaving">Cancel</Button>
        <Button @click="save" :disabled="isSaving || isLoading">
          <LoaderCircle v-if="isSaving" class="size-4 animate-spin" />
          {{ isSaving ? 'Saving...' : 'Save Template' }}
        </Button>
      </div>
    </div>

    <Separator />

    <!-- Editor + Preview -->
    <div class="grid flex-1 gap-6 lg:grid-cols-[1fr_1fr]">
      <!-- Form -->
      <div class="flex flex-col gap-4 overflow-y-auto">
        <!-- Page Setup -->
        <Card>
          <CardHeader>
            <CardTitle class="text-sm">Page Setup</CardTitle>
          </CardHeader>
          <CardContent class="grid gap-4 sm:grid-cols-2">
            <div class="flex flex-col gap-2">
              <Label>Paper Size</Label>
              <Select v-model="template.paperSize">
                <SelectTrigger><SelectValue placeholder="Select size" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="a4">A4</SelectItem>
                  <SelectItem value="a5">A5</SelectItem>
                  <SelectItem value="letter">Letter</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="flex flex-col gap-2">
              <Label>Orientation</Label>
              <Select v-model="template.orientation">
                <SelectTrigger><SelectValue placeholder="Select orientation" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="portrait">Portrait</SelectItem>
                  <SelectItem value="landscape">Landscape</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="flex flex-col gap-2">
              <Label>Font Family</Label>
              <Select v-model="template.fontFamily">
                <SelectTrigger><SelectValue placeholder="Select font" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sans-serif">Sans Serif</SelectItem>
                  <SelectItem value="serif">Serif</SelectItem>
                  <SelectItem value="monospace">Monospace</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="col-span-full flex flex-col gap-2">
              <div class="flex items-center justify-between">
                <Label>Font Size (px)</Label>
                <span class="text-xs tabular-nums text-muted-foreground">{{ template.fontSize }}</span>
              </div>
              <Slider :model-value="[template.fontSize]" :min="8" :max="24" :step="1" @update:model-value="template.fontSize = $event[0]" />
            </div>
            <div class="col-span-full flex flex-col gap-3">
              <Label>Margins (mm)</Label>
              <div class="grid grid-cols-2 gap-4">
                <div v-for="side in (['top', 'bottom', 'left', 'right'] as const)" :key="side" class="flex flex-col gap-1.5">
                  <div class="flex items-center justify-between">
                    <span class="text-xs capitalize text-muted-foreground">{{ side }}</span>
                    <span class="text-xs tabular-nums text-muted-foreground">{{ template.margins[side] }}</span>
                  </div>
                  <Slider :model-value="[template.margins[side]]" :min="0" :max="50" :step="1" @update:model-value="template.margins[side] = $event[0]" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- Header -->
        <Card>
          <CardHeader>
            <CardTitle class="text-sm">Header</CardTitle>
          </CardHeader>
          <CardContent class="flex flex-col gap-4">
            <div class="flex flex-col gap-3">
              <div class="flex items-center gap-2">
                <Checkbox id="cs-show-logo" :model-value="template.header.showLogo" @update:model-value="template.header.showLogo = !!$event" />
                <Label for="cs-show-logo" class="font-normal">Show clinic logo</Label>
              </div>
              <div v-if="template.header.showLogo" class="flex items-center gap-3 pl-6">
                <Label class="shrink-0 text-xs text-muted-foreground">Logo size</Label>
                <Slider :model-value="[template.header.logoSize ?? 40]" :min="20" :max="100" :step="5" class="w-32" @update:model-value="template.header.logoSize = $event[0]" />
                <span class="w-6 text-center text-xs tabular-nums text-muted-foreground">{{ template.header.logoSize ?? 40 }}</span>
              </div>
              <div class="flex items-center gap-2">
                <Checkbox id="cs-show-clinic-name" :model-value="template.header.showClinicName" @update:model-value="template.header.showClinicName = !!$event" />
                <Label for="cs-show-clinic-name" class="font-normal">Show clinic name</Label>
              </div>
              <div class="flex items-center gap-2">
                <Checkbox id="cs-show-clinic-address" :model-value="template.header.showClinicAddress" @update:model-value="template.header.showClinicAddress = !!$event" />
                <Label for="cs-show-clinic-address" class="font-normal">Show clinic address</Label>
              </div>
              <div class="flex items-center gap-2">
                <Checkbox id="cs-show-clinic-contact" :model-value="template.header.showClinicContact" @update:model-value="template.header.showClinicContact = !!$event" />
                <Label for="cs-show-clinic-contact" class="font-normal">Show clinic contact</Label>
              </div>
            </div>
            <div class="flex flex-col gap-2">
              <Label>Custom Header Text</Label>
              <Textarea v-model="template.header.customText" placeholder="Optional text to display in the header" rows="2" />
            </div>
          </CardContent>
        </Card>

        <!-- Body -->
        <Card>
          <CardHeader>
            <CardTitle class="text-sm">Body</CardTitle>
          </CardHeader>
          <CardContent class="flex flex-col gap-3">
            <div class="flex items-center gap-2">
              <Checkbox id="cs-patient-name" :model-value="template.body.showPatientName" @update:model-value="template.body.showPatientName = !!$event" />
              <Label for="cs-patient-name" class="font-normal">Show patient name</Label>
            </div>
            <div class="flex items-center gap-2">
              <Checkbox id="cs-patient-age" :model-value="template.body.showPatientAge" @update:model-value="template.body.showPatientAge = !!$event" />
              <Label for="cs-patient-age" class="font-normal">Show patient age</Label>
            </div>
            <div class="flex items-center gap-2">
              <Checkbox id="cs-patient-gender" :model-value="template.body.showPatientGender" @update:model-value="template.body.showPatientGender = !!$event" />
              <Label for="cs-patient-gender" class="font-normal">Show patient sex</Label>
            </div>
            <div class="flex items-center gap-2">
              <Checkbox id="cs-date" :model-value="template.body.showDate" @update:model-value="template.body.showDate = !!$event" />
              <Label for="cs-date" class="font-normal">Show date</Label>
            </div>
            <div class="flex items-center gap-2">
              <Checkbox id="cs-doctor" :model-value="template.body.showDoctorName" @update:model-value="template.body.showDoctorName = !!$event" />
              <Label for="cs-doctor" class="font-normal">Show attending physician</Label>
            </div>
            <Separator />
            <div class="flex items-center gap-2">
              <Checkbox id="cs-cc" :model-value="template.body.showChiefComplaint" @update:model-value="template.body.showChiefComplaint = !!$event" />
              <Label for="cs-cc" class="font-normal">Show chief complaint</Label>
            </div>
            <div class="flex items-center gap-2">
              <Checkbox id="cs-vitals" :model-value="template.body.showVitals" @update:model-value="template.body.showVitals = !!$event" />
              <Label for="cs-vitals" class="font-normal">Show vitals</Label>
            </div>
            <div class="flex items-center gap-2">
              <Checkbox id="cs-bmi" :model-value="template.body.showBMI" @update:model-value="template.body.showBMI = !!$event" />
              <Label for="cs-bmi" class="font-normal">Show BMI</Label>
            </div>
            <div class="flex items-center gap-2">
              <Checkbox id="cs-allergies" :model-value="template.body.showAllergies" @update:model-value="template.body.showAllergies = !!$event" />
              <Label for="cs-allergies" class="font-normal">Show allergies</Label>
            </div>
            <div class="flex items-center gap-2">
              <Checkbox id="cs-conditions" :model-value="template.body.showChronicConditions" @update:model-value="template.body.showChronicConditions = !!$event" />
              <Label for="cs-conditions" class="font-normal">Show chronic conditions</Label>
            </div>
            <Separator />
            <div class="flex items-center gap-2">
              <Checkbox id="cs-diagnoses" :model-value="template.body.showDiagnoses" @update:model-value="template.body.showDiagnoses = !!$event" />
              <Label for="cs-diagnoses" class="font-normal">Show diagnoses</Label>
            </div>
            <div class="flex items-center gap-2">
              <Checkbox id="cs-assessment" :model-value="template.body.showAssessmentNotes" @update:model-value="template.body.showAssessmentNotes = !!$event" />
              <Label for="cs-assessment" class="font-normal">Show assessment notes</Label>
            </div>
            <div class="flex items-center gap-2">
              <Checkbox id="cs-rx" :model-value="template.body.showPrescription" @update:model-value="template.body.showPrescription = !!$event" />
              <Label for="cs-rx" class="font-normal">Show prescription</Label>
            </div>
            <div class="flex items-center gap-2">
              <Checkbox id="cs-lab" :model-value="template.body.showLabOrders" @update:model-value="template.body.showLabOrders = !!$event" />
              <Label for="cs-lab" class="font-normal">Show lab orders</Label>
            </div>
            <Separator />
            <div class="flex items-center gap-2">
              <Checkbox id="cs-advice" :model-value="template.body.showAdvice" @update:model-value="template.body.showAdvice = !!$event" />
              <Label for="cs-advice" class="font-normal">Show advice / instructions</Label>
            </div>
            <div class="flex items-center gap-2">
              <Checkbox id="cs-followup" :model-value="template.body.showFollowUp" @update:model-value="template.body.showFollowUp = !!$event" />
              <Label for="cs-followup" class="font-normal">Show follow-up date</Label>
            </div>
          </CardContent>
        </Card>

        <!-- Footer -->
        <Card>
          <CardHeader>
            <CardTitle class="text-sm">Footer</CardTitle>
          </CardHeader>
          <CardContent class="flex flex-col gap-4">
            <div class="flex flex-col gap-3">
              <div class="flex items-center gap-2">
                <Checkbox id="cs-signature" :model-value="template.footer.showDoctorSignature" @update:model-value="template.footer.showDoctorSignature = !!$event" />
                <Label for="cs-signature" class="font-normal">Show doctor signature line</Label>
              </div>
              <div class="flex items-center gap-2">
                <Checkbox id="cs-specialty" :model-value="template.footer.showSpecialty" @update:model-value="template.footer.showSpecialty = !!$event" />
                <Label for="cs-specialty" class="font-normal">Show specialty</Label>
              </div>
              <div class="flex items-center gap-2">
                <Checkbox id="cs-sub-specialty" :model-value="template.footer.showSubSpecialty" @update:model-value="template.footer.showSubSpecialty = !!$event" />
                <Label for="cs-sub-specialty" class="font-normal">Show sub-specialty</Label>
              </div>
              <div class="flex items-center gap-2">
                <Checkbox id="cs-prc" :model-value="template.footer.showPrcLicense" @update:model-value="template.footer.showPrcLicense = !!$event" />
                <Label for="cs-prc" class="font-normal">Show PRC License No.</Label>
              </div>
              <div class="flex items-center gap-2">
                <Checkbox id="cs-ptr" :model-value="template.footer.showPtrNumber" @update:model-value="template.footer.showPtrNumber = !!$event" />
                <Label for="cs-ptr" class="font-normal">Show PTR No.</Label>
              </div>
              <div class="flex items-center gap-2">
                <Checkbox id="cs-s2" :model-value="template.footer.showS2License" @update:model-value="template.footer.showS2License = !!$event" />
                <Label for="cs-s2" class="font-normal">Show S2 License No.</Label>
              </div>
              <div class="flex items-center gap-2">
                <Checkbox id="cs-page" :model-value="template.footer.showPageNumber" @update:model-value="template.footer.showPageNumber = !!$event" />
                <Label for="cs-page" class="font-normal">Show page number</Label>
              </div>
              <div class="flex items-center gap-2">
                <Checkbox id="cs-watermark" :model-value="template.footer.showWatermark" @update:model-value="template.footer.showWatermark = !!$event" />
                <Label for="cs-watermark" class="font-normal text-muted-foreground">Show watermark <span class="text-xs">(Pro accounts can hide this)</span></Label>
              </div>
            </div>
            <div class="flex flex-col gap-2">
              <Label>Custom Footer Text</Label>
              <Textarea v-model="template.footer.customText" placeholder="Optional text to display in the footer" rows="2" />
            </div>
          </CardContent>
        </Card>
      </div>

      <!-- Live Preview -->
      <div class="sticky top-4 flex flex-col gap-2">
        <h3 class="text-sm font-medium text-muted-foreground">Preview</h3>
        <div class="flex items-start justify-center rounded-lg border bg-muted/30 p-6">
          <div
            class="relative w-full overflow-hidden bg-white shadow-lg"
            :class="template.orientation === 'landscape' ? 'aspect-[1.414/1] max-w-[500px]' : 'aspect-[1/1.414] max-w-[360px]'"
            :style="{
              fontFamily: template.fontFamily,
              fontSize: `${template.fontSize * 0.55}px`,
              padding: `${template.margins.top * 0.8}px ${template.margins.right * 0.8}px ${template.margins.bottom * 0.8}px ${template.margins.left * 0.8}px`,
            }"
          >
            <div class="flex h-full flex-col">
              <!-- Preview Header -->
              <div v-if="template.header.showClinicName || template.header.showLogo || template.header.showClinicAddress || template.header.showClinicContact" class="mb-2 flex items-start gap-2 border-b pb-2">
                <div v-if="template.header.showLogo" class="shrink-0" :style="{ width: `${(template.header.logoSize ?? 40) * 0.5}px`, height: `${(template.header.logoSize ?? 40) * 0.5}px` }">
                  <img v-if="clinicLogoUrl" :src="clinicLogoUrl" alt="Logo" class="size-full rounded object-cover" />
                  <div v-else class="flex size-full items-center justify-center rounded bg-muted text-[7px] text-muted-foreground">Logo</div>
                </div>
                <div>
                  <div v-if="template.header.showClinicName" class="font-bold" :style="{ fontSize: `${template.fontSize * 0.7}px` }">{{ clinicName }}</div>
                  <div v-if="template.header.showClinicAddress" class="text-muted-foreground" :style="{ fontSize: `${template.fontSize * 0.45}px` }">{{ clinicAddress || 'No address set' }}</div>
                  <div v-if="template.header.showClinicContact" class="text-muted-foreground" :style="{ fontSize: `${template.fontSize * 0.45}px` }">{{ [clinicContact, clinicEmail].filter(Boolean).join(' | ') || 'No contact set' }}</div>
                </div>
              </div>

              <!-- Title -->
              <div class="mb-2 text-center font-bold uppercase" :style="{ fontSize: `${template.fontSize * 0.7}px`, letterSpacing: '2px' }">Consultation Summary</div>

              <!-- Patient Info -->
              <div class="mb-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                <span v-if="template.body.showPatientName"><strong>Patient:</strong> Juan Dela Cruz</span>
                <span v-if="template.body.showPatientAge"><strong>Age:</strong> 32</span>
                <span v-if="template.body.showPatientGender"><strong>Sex:</strong> Male</span>
                <span v-if="template.body.showDate"><strong>Date:</strong> Mar 25, 2026</span>
              </div>

              <div v-if="template.body.showDoctorName" class="mb-1.5"><strong>Attending Physician:</strong> {{ doctorName }}</div>

              <!-- Scrollable body preview -->
              <div class="flex-1 flex flex-col gap-1.5 overflow-hidden">
                <!-- Chief Complaint -->
                <div v-if="template.body.showChiefComplaint">
                  <div class="font-bold uppercase text-muted-foreground border-b border-border/50 mb-0.5" :style="{ fontSize: `${template.fontSize * 0.45}px`, letterSpacing: '0.5px' }">Chief Complaint</div>
                  <div>Headache and fever for 2 days</div>
                </div>

                <!-- Vitals -->
                <div v-if="template.body.showVitals">
                  <div class="font-bold uppercase text-muted-foreground border-b border-border/50 mb-0.5" :style="{ fontSize: `${template.fontSize * 0.45}px`, letterSpacing: '0.5px' }">Vitals</div>
                  <div class="grid grid-cols-2 gap-x-3">
                    <div class="flex justify-between"><span class="text-muted-foreground">BP</span> <span><ArrowUp class="inline size-2 text-red-600" /> 140/90</span></div>
                    <div class="flex justify-between"><span class="text-muted-foreground">HR</span> <span>78 bpm</span></div>
                    <div class="flex justify-between"><span class="text-muted-foreground">Temp</span> <span><ArrowUp class="inline size-2 text-red-600" /> 38.2 °C</span></div>
                    <div class="flex justify-between"><span class="text-muted-foreground">SpO2</span> <span>98%</span></div>
                    <div v-if="template.body.showBMI" class="flex justify-between"><span class="text-muted-foreground">BMI</span> <span>24.2 <span class="text-green-600">(Normal)</span></span></div>
                  </div>
                </div>

                <!-- Allergies -->
                <div v-if="template.body.showAllergies">
                  <div class="font-bold uppercase text-muted-foreground border-b border-border/50 mb-0.5" :style="{ fontSize: `${template.fontSize * 0.45}px`, letterSpacing: '0.5px' }">Allergies</div>
                  <div class="flex gap-1">
                    <span class="rounded-full bg-muted px-1.5 py-0 text-[9px]">Penicillin</span>
                    <span class="rounded-full bg-muted px-1.5 py-0 text-[9px]">Aspirin</span>
                  </div>
                </div>

                <!-- Diagnoses -->
                <div v-if="template.body.showDiagnoses">
                  <div class="font-bold uppercase text-muted-foreground border-b border-border/50 mb-0.5" :style="{ fontSize: `${template.fontSize * 0.45}px`, letterSpacing: '0.5px' }">Diagnosis</div>
                  <div class="font-medium">Upper Respiratory Tract Infection <span class="font-normal font-mono text-muted-foreground" :style="{ fontSize: `${template.fontSize * 0.45}px` }">J06.9</span></div>
                </div>

                <!-- Prescription -->
                <div v-if="template.body.showPrescription">
                  <div class="font-bold uppercase text-muted-foreground border-b border-border/50 mb-0.5" :style="{ fontSize: `${template.fontSize * 0.45}px`, letterSpacing: '0.5px' }">Prescription</div>
                  <div class="pl-2">
                    <div>1. Paracetamol 500mg <span class="text-muted-foreground italic" :style="{ fontSize: `${template.fontSize * 0.45}px` }">Oral, Every 6 hours</span></div>
                    <div>2. Amoxicillin 500mg <span class="text-muted-foreground italic" :style="{ fontSize: `${template.fontSize * 0.45}px` }">Oral, Three times daily, for 7 days</span></div>
                  </div>
                </div>

                <!-- Lab Orders -->
                <div v-if="template.body.showLabOrders">
                  <div class="font-bold uppercase text-muted-foreground border-b border-border/50 mb-0.5" :style="{ fontSize: `${template.fontSize * 0.45}px`, letterSpacing: '0.5px' }">Lab Orders</div>
                  <div class="pl-2">
                    <div>1. CBC <span class="rounded bg-amber-100 text-amber-700 px-1 text-[8px] font-semibold">PENDING</span></div>
                    <div>2. Urinalysis <span class="rounded bg-green-100 text-green-700 px-1 text-[8px] font-semibold">DONE</span></div>
                  </div>
                </div>

                <!-- Advice -->
                <div v-if="template.body.showAdvice">
                  <div class="font-bold uppercase text-muted-foreground border-b border-border/50 mb-0.5" :style="{ fontSize: `${template.fontSize * 0.45}px`, letterSpacing: '0.5px' }">Advice</div>
                  <div>Increase fluid intake. Rest for 3 days.</div>
                </div>

                <!-- Follow-up -->
                <div v-if="template.body.showFollowUp">
                  <div class="font-bold uppercase text-muted-foreground border-b border-border/50 mb-0.5" :style="{ fontSize: `${template.fontSize * 0.45}px`, letterSpacing: '0.5px' }">Follow-up</div>
                  <div>April 01, 2026</div>
                </div>
              </div>

              <!-- Preview Footer -->
              <div v-if="template.footer.showDoctorSignature || template.footer.showPrcLicense || template.footer.showPtrNumber || template.footer.showS2License || template.footer.customText" class="mt-auto border-t pt-2">
                <div v-if="template.footer.showDoctorSignature" class="mt-3 flex flex-col items-end gap-0.5">
                  <div class="w-28 border-b" />
                  <span>{{ doctorName }}</span>
                  <div v-if="template.footer.showSpecialty && specialty" class="text-muted-foreground" :style="{ fontSize: `${template.fontSize * 0.4}px` }">{{ specialty }}</div>
                  <div v-if="template.footer.showSubSpecialty && subSpecialty" class="text-muted-foreground" :style="{ fontSize: `${template.fontSize * 0.4}px` }">{{ subSpecialty }}</div>
                </div>
                <div v-if="template.footer.showPrcLicense" class="text-right text-muted-foreground" :style="{ fontSize: `${template.fontSize * 0.4}px` }">PRC Lic. No. {{ prcLicense || '---' }}</div>
                <div v-if="template.footer.showPtrNumber" class="text-right text-muted-foreground" :style="{ fontSize: `${template.fontSize * 0.4}px` }">PTR No. {{ ptrNumber || '---' }}</div>
                <div v-if="template.footer.showS2License" class="text-right text-muted-foreground" :style="{ fontSize: `${template.fontSize * 0.4}px` }">S2 Lic. No. {{ s2License || '---' }}</div>
                <div v-if="template.footer.customText" class="mt-1 text-center text-muted-foreground" :style="{ fontSize: `${template.fontSize * 0.4}px` }">{{ template.footer.customText }}</div>
                <div v-if="template.footer.showPageNumber" class="mt-1 text-center text-muted-foreground" :style="{ fontSize: `${template.fontSize * 0.35}px` }">Page 1 of 1</div>
              </div>

              <!-- Watermark -->
              <div v-if="template.footer.showWatermark" class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 opacity-[0.12]">
                <img src="/favicon.svg" alt="" class="size-36 select-none" />
                <span class="select-none text-lg font-bold uppercase tracking-widest text-foreground">MediFlow</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
