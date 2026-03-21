<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import { defaultPrescriptionTemplate, type PrescriptionTemplate } from '@/domains/template/types/template.types'

const props = withDefaults(defineProps<{
  config?: PrescriptionTemplate | null
}>(), {
  config: null,
})

const authStore = useAuthStore()

const t = computed(() => props.config ?? defaultPrescriptionTemplate)
const clinicName = computed(() => authStore.currentClinic?.clinic_name ?? 'Clinic')
const clinicAddress = computed(() => authStore.currentClinic?.address ?? '')
const clinicContact = computed(() => authStore.currentClinic?.contact_number ?? '')
const clinicEmail = computed(() => authStore.currentClinic?.email ?? '')
const clinicLogoUrl = computed(() => authStore.currentClinic?.logo_url ?? null)
const doctorName = computed(() => [authStore.user?.title_prefix, authStore.user?.name].filter(Boolean).join(' ') || 'Doctor')
const specialty = computed(() => authStore.user?.specialty ?? '')
const subSpecialty = computed(() => authStore.user?.sub_specialty ?? '')
const prcLicense = computed(() => authStore.user?.prc_license_number ?? '')
const ptrNumber = computed(() => authStore.user?.ptr_number ?? '')
const s2License = computed(() => authStore.user?.s2_license_number ?? '')
</script>

<template>
  <div
    class="relative flex h-full w-full flex-col overflow-hidden rounded bg-white text-foreground shadow-sm"
    style="font-size: 4px; padding: 6px; line-height: 1.4"
  >
    <!-- Header -->
    <div
      v-if="t.header.showClinicName || t.header.showLogo || t.header.showClinicAddress || t.header.showClinicContact"
      class="mb-1 flex items-start gap-1 border-b border-border/40 pb-1"
    >
      <div v-if="t.header.showLogo" class="shrink-0" :style="{ width: `${(t.header.logoSize ?? 40) * 0.15}px`, height: `${(t.header.logoSize ?? 40) * 0.15}px` }">
        <img v-if="clinicLogoUrl" :src="clinicLogoUrl" alt="" class="size-full object-cover" />
        <div v-else class="flex size-full items-center justify-center bg-muted" style="font-size: 2px">Logo</div>
      </div>
      <div class="min-w-0">
          <div v-if="t.header.showClinicName" class="truncate font-bold" style="font-size: 5px">
            {{ clinicName }}
          </div>
          <div v-if="t.header.showClinicAddress" class="truncate text-muted-foreground" style="font-size: 3px">
            {{ clinicAddress || 'No address set' }}
          </div>
          <div v-if="t.header.showClinicContact" class="truncate text-muted-foreground" style="font-size: 3px">
            {{ [clinicContact, clinicEmail].filter(Boolean).join(' | ') || 'No contact set' }}
          </div>
          <div v-if="t.header.customText" class="truncate text-muted-foreground" style="font-size: 3px">
            {{ t.header.customText }}
          </div>
      </div>
    </div>

    <!-- Body -->
    <div class="flex-1">
      <div class="mb-0.5 flex flex-wrap gap-x-1">
        <span v-if="t.body.showPatientName"><strong>Patient:</strong> Juan Dela Cruz</span>
        <span v-if="t.body.showPatientAge"><strong>Age:</strong> 32</span>
        <span v-if="t.body.showPatientGender"><strong>Sex:</strong> Male</span>
        <span v-if="t.body.showDate"><strong>Date:</strong> Mar 21, 2026</span>
      </div>

      <div v-if="t.body.showDoctorName" class="mb-0.5">
        <strong>{{ doctorName }}</strong>
      </div>

      <div class="mb-0.5 font-bold">Rx</div>
      <div class="flex flex-col gap-0.5 pl-1">
        <div>
          <div class="flex justify-between">
            <span>1. Amoxicillin 500mg</span>
            <span>#21</span>
          </div>
          <div class="pl-1 italic text-muted-foreground">Take 1 capsule 3x a day for 7 days</div>
        </div>
        <div>
          <div class="flex justify-between">
            <span>2. Paracetamol 500mg</span>
            <span>#10</span>
          </div>
          <div class="pl-1 italic text-muted-foreground">Take 1 tablet every 4hrs as needed</div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div
      v-if="t.footer.showDoctorSignature || t.footer.showPrcLicense || t.footer.showPtrNumber || t.footer.showS2License || t.footer.customText"
      class="mt-auto border-t border-border/40 pt-1"
    >
      <div v-if="t.footer.showDoctorSignature" class="mt-1 flex flex-col items-end gap-0">
        <div class="w-8 border-b border-foreground/30" />
        <span style="font-size: 3px">{{ doctorName }}</span>
        <div v-if="t.footer.showSpecialty && specialty" class="text-muted-foreground" style="font-size: 2.5px">{{ specialty }}</div>
        <div v-if="t.footer.showSubSpecialty && subSpecialty" class="text-muted-foreground" style="font-size: 2.5px">{{ subSpecialty }}</div>
      </div>
      <div v-if="t.footer.showPrcLicense" class="text-right text-muted-foreground" style="font-size: 2.5px">
        PRC Lic. No. {{ prcLicense || '—' }}
      </div>
      <div v-if="t.footer.showPtrNumber" class="text-right text-muted-foreground" style="font-size: 2.5px">
        PTR No. {{ ptrNumber || '—' }}
      </div>
      <div v-if="t.footer.showS2License" class="text-right text-muted-foreground" style="font-size: 2.5px">
        S2 Lic. No. {{ s2License || '—' }}
      </div>
      <div v-if="t.footer.customText" class="text-center text-muted-foreground" style="font-size: 2.5px">
        {{ t.footer.customText }}
      </div>
      <div v-if="t.footer.showPageNumber" class="text-center text-muted-foreground" style="font-size: 2px">
        Page 1 of 1
      </div>
    </div>

    <!-- Watermark -->
    <div v-if="t.footer.showWatermark" class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5 opacity-[0.12]">
      <img src="/favicon.svg" alt="" class="size-8 select-none" />
      <span class="select-none font-bold uppercase tracking-widest text-foreground" style="font-size: 4px">MediFlow</span>
    </div>
  </div>
</template>
