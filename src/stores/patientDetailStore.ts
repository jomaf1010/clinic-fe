import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import { patientApi } from '@/domains/patient/api/patientApi'
import type {
  PatientResponse,
  Problem,
  CreateProblemPayload,
  UpdateProblemPayload,
} from '@/domains/patient/types/patient.types'
import type {
  StructuredAllergy,
  StoreAllergyPayload,
  FamilyHistoryEntry,
  StoreFamilyHistoryPayload,
  Medication,
  StoreMedicationPayload,
  PreventiveCareItem,
  StorePreventiveCarePayload,
} from '@/domains/patient/api/patientApi'
import type { LifestyleData } from '@/domains/consultation/types/consultation.types'
import type { ChronicTrendsData } from '@/domains/patient/types/patient.types'

// ─── Store ──────────────────────────────────────────────────────────────────

export const usePatientDetailStore = defineStore('patientDetail', () => {
  // ── Core state ────────────────────────────────────────────────────────────
  const patientId = ref<string | null>(null)
  const patient = ref<PatientResponse | null>(null)
  const problems = ref<Problem[]>([])
  const allergies = ref<StructuredAllergy[]>([])
  const pastDiagnoses = ref<{ description: string; code: string | null }[]>([])

  // ── FM / IM state ──────────────────────────────────────────────────────────
  const lifestyle = ref<LifestyleData | null>(null)
  const familyHistory = ref<FamilyHistoryEntry[]>([])
  const medications = ref<Medication[]>([])
  const preventiveCare = ref<PreventiveCareItem[]>([])
  const chronicTrends = ref<ChronicTrendsData | null>(null)

  // ── Loading flags ─────────────────────────────────────────────────────────
  const isLoading = ref(false)
  const isLoadingCore = ref(false)
  const isLoadingFM = ref(false)

  // ── Computed ──────────────────────────────────────────────────────────────
  const patientAge = computed(() => {
    if (!patient.value?.date_of_birth) return null
    const dob = new Date(patient.value.date_of_birth)
    const today = new Date()
    let age = today.getFullYear() - dob.getFullYear()
    const m = today.getMonth() - dob.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--
    return age
  })

  const patientBloodType = computed(() => patient.value?.blood_type ?? null)

  // ── Core actions ──────────────────────────────────────────────────────────

  async function loadPatient(id: string): Promise<void> {
    isLoading.value = true
    patientId.value = id
    try {
      const res = await patientApi.get(id)
      patient.value = res.data
    } catch {
      patient.value = null
      throw new Error('Failed to load patient')
    } finally {
      isLoading.value = false
    }
  }

  async function loadCore(): Promise<void> {
    if (!patientId.value) return
    isLoadingCore.value = true
    const id = patientId.value
    try {
      const [problemsRes, allergiesRes, diagnosesRes] = await Promise.all([
        patientApi.getProblems(id),
        patientApi.getAllergies(id),
        patientApi.getPastDiagnoses(id).catch(() => ({ data: [] })),
      ])
      problems.value = problemsRes.data
      allergies.value = allergiesRes.data
      pastDiagnoses.value = diagnosesRes.data
    } finally {
      isLoadingCore.value = false
    }
  }

  function updatePatientFromSync(updated: PatientResponse): void {
    patient.value = updated
  }

  // ── Problems CRUD ─────────────────────────────────────────────────────────

  async function addProblem(payload: CreateProblemPayload): Promise<Problem> {
    if (!patientId.value) throw new Error('No patient loaded')
    const res = await patientApi.addProblem(patientId.value, payload)
    problems.value.unshift(res.data)
    toast.success('Problem added')
    return res.data
  }

  async function updateProblem(problemUuid: string, payload: UpdateProblemPayload): Promise<Problem> {
    const res = await patientApi.updateProblem(problemUuid, payload)
    const idx = problems.value.findIndex((p) => p.uuid === problemUuid)
    if (idx !== -1) problems.value[idx] = res.data
    toast.success('Problem updated')
    return res.data
  }

  async function deleteProblem(problemUuid: string): Promise<void> {
    await patientApi.deleteProblem(problemUuid)
    problems.value = problems.value.filter((p) => p.uuid !== problemUuid)
    toast.success('Problem removed')
  }

  // ── Allergies CRUD ────────────────────────────────────────────────────────

  async function addAllergy(payload: StoreAllergyPayload): Promise<StructuredAllergy> {
    if (!patientId.value) throw new Error('No patient loaded')
    const res = await patientApi.addAllergy(patientId.value, payload)
    allergies.value.unshift(res.data)
    toast.success('Allergy added')
    return res.data
  }

  async function updateAllergy(allergyUuid: string, payload: StoreAllergyPayload): Promise<StructuredAllergy> {
    if (!patientId.value) throw new Error('No patient loaded')
    const res = await patientApi.updateAllergy(patientId.value, allergyUuid, payload)
    const idx = allergies.value.findIndex((a) => a.uuid === allergyUuid)
    if (idx !== -1) allergies.value[idx] = res.data
    toast.success('Allergy updated')
    return res.data
  }

  async function deleteAllergy(allergyUuid: string): Promise<void> {
    if (!patientId.value) throw new Error('No patient loaded')
    await patientApi.deleteAllergy(patientId.value, allergyUuid)
    allergies.value = allergies.value.filter((a) => a.uuid !== allergyUuid)
    toast.success('Allergy removed')
  }

  // ── FM / IM actions ────────────────────────────────────────────────────────

  async function loadFM(): Promise<void> {
    if (!patientId.value) return
    isLoadingFM.value = true
    const id = patientId.value
    try {
      const [lifestyleRes, familyRes, medsRes, preventiveRes, trendsRes] = await Promise.all([
        patientApi.getLifestyle(id).catch(() => ({ data: null })),
        patientApi.getFamilyHistory(id).catch(() => ({ data: [] })),
        patientApi.getMedications(id).catch(() => ({ data: [] })),
        patientApi.getPreventiveCare(id).catch(() => ({ data: [] })),
        patientApi.getChronicTrends(id).catch(() => ({ data: null })),
      ])
      lifestyle.value = lifestyleRes.data as LifestyleData | null
      familyHistory.value = familyRes.data as FamilyHistoryEntry[]
      medications.value = medsRes.data as Medication[]
      preventiveCare.value = preventiveRes.data as PreventiveCareItem[]
      chronicTrends.value = trendsRes.data as ChronicTrendsData | null
    } finally {
      isLoadingFM.value = false
    }
  }

  async function updateLifestyle(payload: LifestyleData): Promise<void> {
    if (!patientId.value) return
    const res = await patientApi.updateLifestyle(patientId.value, payload)
    lifestyle.value = res.data
    toast.success('Lifestyle updated')
  }

  async function addFamilyHistory(payload: StoreFamilyHistoryPayload): Promise<FamilyHistoryEntry> {
    if (!patientId.value) throw new Error('No patient loaded')
    const res = await patientApi.addFamilyHistory(patientId.value, payload)
    familyHistory.value.unshift(res.data)
    toast.success('Family history added')
    return res.data
  }

  async function updateFamilyHistory(entryUuid: string, payload: StoreFamilyHistoryPayload): Promise<FamilyHistoryEntry> {
    if (!patientId.value) throw new Error('No patient loaded')
    const res = await patientApi.updateFamilyHistory(patientId.value, entryUuid, payload)
    const idx = familyHistory.value.findIndex((e) => e.uuid === entryUuid)
    if (idx !== -1) familyHistory.value[idx] = res.data
    toast.success('Family history updated')
    return res.data
  }

  async function deleteFamilyHistory(entryUuid: string): Promise<void> {
    if (!patientId.value) throw new Error('No patient loaded')
    await patientApi.deleteFamilyHistory(patientId.value, entryUuid)
    familyHistory.value = familyHistory.value.filter((e) => e.uuid !== entryUuid)
    toast.success('Family history removed')
  }

  async function addMedication(payload: StoreMedicationPayload): Promise<Medication> {
    if (!patientId.value) throw new Error('No patient loaded')
    const res = await patientApi.addMedication(patientId.value, payload)
    medications.value.unshift(res.data)
    toast.success('Medication added')
    return res.data
  }

  async function updateMedication(entryUuid: string, payload: StoreMedicationPayload): Promise<Medication> {
    if (!patientId.value) throw new Error('No patient loaded')
    const res = await patientApi.updateMedication(patientId.value, entryUuid, payload)
    const idx = medications.value.findIndex((m) => m.uuid === entryUuid)
    if (idx !== -1) medications.value[idx] = res.data
    return res.data
  }

  async function deleteMedication(entryUuid: string): Promise<void> {
    if (!patientId.value) throw new Error('No patient loaded')
    await patientApi.deleteMedication(patientId.value, entryUuid)
    medications.value = medications.value.filter((m) => m.uuid !== entryUuid)
    toast.success('Medication removed')
  }

  async function addPreventiveCare(payload: StorePreventiveCarePayload): Promise<PreventiveCareItem> {
    if (!patientId.value) throw new Error('No patient loaded')
    const res = await patientApi.storePreventiveCare(patientId.value, payload)
    // Reload full list since items may merge
    const listRes = await patientApi.getPreventiveCare(patientId.value)
    preventiveCare.value = listRes.data
    toast.success('Preventive care recorded')
    return res.data
  }

  async function updatePreventiveCare(entryUuid: string, payload: StorePreventiveCarePayload): Promise<void> {
    if (!patientId.value) throw new Error('No patient loaded')
    await patientApi.updatePreventiveCare(patientId.value, entryUuid, payload)
    // Reload full list
    const listRes = await patientApi.getPreventiveCare(patientId.value)
    preventiveCare.value = listRes.data
    toast.success('Preventive care updated')
  }

  async function deletePreventiveCare(entryUuid: string): Promise<void> {
    if (!patientId.value) throw new Error('No patient loaded')
    await patientApi.deletePreventiveCare(patientId.value, entryUuid)
    // Reload full list
    const listRes = await patientApi.getPreventiveCare(patientId.value)
    preventiveCare.value = listRes.data
    toast.success('Preventive care removed')
  }

  async function reloadChronicTrends(): Promise<void> {
    if (!patientId.value) return
    const res = await patientApi.getChronicTrends(patientId.value)
    chronicTrends.value = res.data
  }

  // ── Reset ─────────────────────────────────────────────────────────────────

  function $reset(): void {
    patientId.value = null
    patient.value = null
    problems.value = []
    allergies.value = []
    pastDiagnoses.value = []
    // FM / IM
    lifestyle.value = null
    familyHistory.value = []
    medications.value = []
    preventiveCare.value = []
    chronicTrends.value = null
    // Flags
    isLoading.value = false
    isLoadingCore.value = false
    isLoadingFM.value = false
  }

  return {
    // State
    patientId,
    patient,
    problems,
    allergies,
    pastDiagnoses,
    isLoading,
    isLoadingCore,

    // Computed
    patientAge,
    patientBloodType,

    // Actions — core
    loadPatient,
    loadCore,
    updatePatientFromSync,
    $reset,

    // Actions — problems
    addProblem,
    updateProblem,
    deleteProblem,

    // Actions — allergies
    addAllergy,
    updateAllergy,
    deleteAllergy,

    // State — FM / IM
    lifestyle,
    familyHistory,
    medications,
    preventiveCare,
    chronicTrends,
    isLoadingFM,

    // Actions — FM / IM
    loadFM,
    updateLifestyle,
    addFamilyHistory,
    updateFamilyHistory,
    deleteFamilyHistory,
    addMedication,
    updateMedication,
    deleteMedication,
    addPreventiveCare,
    updatePreventiveCare,
    deletePreventiveCare,
    reloadChronicTrends,
  }
})
