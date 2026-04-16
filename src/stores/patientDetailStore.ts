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
import { obgynApi } from '@/domains/obgyn/api/obgynApi'
import type { CreatePregnancyPayload, UpsertGynProfilePayload } from '@/domains/obgyn/api/obgynApi'
import type { GynProfile, Pregnancy, PregnancyDashboard, PrenatalVisit, ChecklistItem } from '@/domains/obgyn/types/obgyn.types'
import { pediatricsApi } from '@/domains/patient/api/pediatricsApi'
import type {
  BirthHistoryResponse,
  BirthHistoryFields,
  FeedingHistoryFields,
  ImmunizationTieredResponse,
  GrowthMeasurement,
  MilestoneScheduleResponse,
  RecordDosePayload,
  StoreMilestonePayload,
} from '@/domains/patient/api/pediatricsApi'

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

  // ── Pediatrics state ───────────────────────────────────────────────────────
  const birthHistory = ref<BirthHistoryResponse['data'] | null>(null)
  const immunizations = ref<ImmunizationTieredResponse | null>(null)
  const growthHistory = ref<GrowthMeasurement[]>([])
  const milestones = ref<MilestoneScheduleResponse | null>(null)

  // ── OB-GYN state ──────────────────────────────────────────────────────────
  const gynProfile = ref<GynProfile | null>(null)
  const pregnancies = ref<Pregnancy[]>([])
  const currentPregnancy = ref<Pregnancy | null>(null)
  const pregnancyDashboard = ref<PregnancyDashboard | null>(null)
  const pregnancyVisits = ref<PrenatalVisit[]>([])
  const prenatalChecklist = ref<ChecklistItem[]>([])

  // ── Loading flags ─────────────────────────────────────────────────────────
  const isLoading = ref(false)
  const isLoadingCore = ref(false)
  const isLoadingFM = ref(false)
  const isLoadingPeds = ref(false)
  const isLoadingObgyn = ref(false)
  const isSavingObgyn = ref(false)

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

  const activePregnancy = computed(() =>
    pregnancies.value.find((p) => p.status === 'active') ?? null,
  )

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

  async function loadSpecialty(key: string): Promise<void> {
    switch (key) {
      case 'family_medicine':
      case 'internal_medicine':
        await loadFM()
        break
      case 'pediatrics':
        await loadPediatrics()
        break
      case 'obgyn':
        await loadObgyn()
        break
    }
  }

  async function uploadAvatar(file: File): Promise<string> {
    if (!patientId.value) throw new Error('No patient loaded')
    const res = await patientApi.uploadAvatar(patientId.value, file)
    if (patient.value) {
      patient.value = { ...patient.value, avatar_url: res.data.avatar_url }
    }
    return res.data.avatar_url
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

  // ── OB-GYN actions ────────────────────────────────────────────────────────

  async function loadObgyn(): Promise<void> {
    if (!patientId.value) return
    isLoadingObgyn.value = true
    const id = patientId.value
    try {
      const [gynRes, pregRes] = await Promise.all([
        obgynApi.getGynProfile(id).catch(() => ({ data: null })),
        obgynApi.listPregnancies(id).catch(() => ({ data: [] })),
      ])
      gynProfile.value = gynRes.data as GynProfile | null
      pregnancies.value = pregRes.data as Pregnancy[]
    } finally {
      isLoadingObgyn.value = false
    }
  }

  async function updateGynProfile(payload: UpsertGynProfilePayload): Promise<GynProfile> {
    if (!patientId.value) throw new Error('No patient loaded')
    const res = await obgynApi.upsertGynProfile(patientId.value, payload)
    gynProfile.value = res.data
    toast.success('GYN profile updated')
    return res.data
  }

  async function createPregnancy(payload: CreatePregnancyPayload): Promise<Pregnancy> {
    if (!patientId.value) throw new Error('No patient loaded')
    isSavingObgyn.value = true
    try {
      const res = await obgynApi.createPregnancy(patientId.value, payload)
      pregnancies.value.unshift(res.data)
      currentPregnancy.value = res.data
      toast.success('Pregnancy record created')
      return res.data
    } catch {
      toast.error('Failed to create pregnancy record')
      throw new Error('Failed to create pregnancy record')
    } finally {
      isSavingObgyn.value = false
    }
  }

  async function updatePregnancy(pregnancyId: string, payload: Partial<CreatePregnancyPayload>): Promise<Pregnancy> {
    if (!patientId.value) throw new Error('No patient loaded')
    isSavingObgyn.value = true
    try {
      const res = await obgynApi.updatePregnancy(patientId.value, pregnancyId, payload)
      currentPregnancy.value = res.data
      const idx = pregnancies.value.findIndex((p) => p.id === pregnancyId)
      if (idx !== -1) pregnancies.value[idx] = res.data
      toast.success('Pregnancy record updated')
      return res.data
    } catch {
      toast.error('Failed to update pregnancy record')
      throw new Error('Failed to update pregnancy record')
    } finally {
      isSavingObgyn.value = false
    }
  }

  async function deletePregnancy(pregnancyId: string): Promise<void> {
    if (!patientId.value) throw new Error('No patient loaded')
    await obgynApi.deletePregnancy(patientId.value, pregnancyId)
    pregnancies.value = pregnancies.value.filter((p) => p.id !== pregnancyId)
    if (currentPregnancy.value?.id === pregnancyId) currentPregnancy.value = null
    toast.success('Pregnancy deleted')
  }

  async function loadPregnancyDetail(pregnancyId: string): Promise<void> {
    if (!patientId.value) return
    const id = patientId.value
    const [pregRes, dashRes, visitsRes, labsRes] = await Promise.all([
      obgynApi.getPregnancy(id, pregnancyId),
      obgynApi.getDashboard(id, pregnancyId).catch(() => ({ data: null })),
      obgynApi.listVisits(id, pregnancyId).catch(() => ({ data: [] })),
      obgynApi.getChecklist(id, pregnancyId).catch(() => ({ data: [] })),
    ])
    currentPregnancy.value = pregRes.data
    pregnancyDashboard.value = dashRes.data as PregnancyDashboard | null
    pregnancyVisits.value = visitsRes.data as PrenatalVisit[]
    prenatalChecklist.value = labsRes.data as ChecklistItem[]
  }

  async function reloadChecklist(pregnancyId: string): Promise<void> {
    if (!patientId.value) return
    const res = await obgynApi.getChecklist(patientId.value, pregnancyId)
    prenatalChecklist.value = res.data
  }

  async function toggleChecklistItem(pregnancyId: string, payload: { key: string; completed: boolean; notes?: string | null }): Promise<void> {
    if (!patientId.value) return
    const res = await obgynApi.toggleChecklistItem(patientId.value, pregnancyId, payload)
    prenatalChecklist.value = res.data
  }

  async function reloadDashboard(pregnancyId: string): Promise<void> {
    if (!patientId.value) return
    const res = await obgynApi.getDashboard(patientId.value, pregnancyId)
    pregnancyDashboard.value = res.data
  }

  async function evaluateRisk(payload: Record<string, unknown>): Promise<{ level: string; factors: string[] }> {
    if (!patientId.value) throw new Error('No patient loaded')
    const res = await obgynApi.evaluateRisk(patientId.value, payload)
    return res.data
  }

  // ── Pediatrics actions ─────────────────────────────────────────────────────

  async function loadPediatrics(): Promise<void> {
    if (!patientId.value) return
    isLoadingPeds.value = true
    const id = patientId.value
    try {
      const [birthRes, immuneRes, growthRes, milestoneRes] = await Promise.all([
        pediatricsApi.getBirthHistory(id).catch(() => ({ data: null })),
        pediatricsApi.getImmunizations(id).catch(() => ({ data: null })),
        pediatricsApi.getGrowthHistory(id).catch(() => ({ data: [] })),
        pediatricsApi.getMilestones(id).catch(() => ({ data: null })),
      ])
      birthHistory.value = birthRes.data as BirthHistoryResponse['data'] | null
      immunizations.value = immuneRes.data as ImmunizationTieredResponse | null
      growthHistory.value = (growthRes.data ?? []) as GrowthMeasurement[]
      milestones.value = milestoneRes.data as MilestoneScheduleResponse | null
    } finally {
      isLoadingPeds.value = false
    }
  }

  async function updateBirthHistory(payload: { birth_history?: Partial<BirthHistoryFields>; feeding_history?: Partial<FeedingHistoryFields> }): Promise<void> {
    if (!patientId.value) return
    const res = await pediatricsApi.updateBirthHistory(patientId.value, payload)
    birthHistory.value = res.data
    toast.success('Birth history updated')
  }

  async function recordDose(payload: RecordDosePayload): Promise<void> {
    if (!patientId.value) return
    await pediatricsApi.recordDose(patientId.value, payload)
    const res = await pediatricsApi.getImmunizations(patientId.value)
    immunizations.value = res.data
    toast.success('Dose recorded')
  }

  async function deleteDose(doseUuid: string): Promise<void> {
    if (!patientId.value) return
    await pediatricsApi.deleteDose(patientId.value, doseUuid)
    const res = await pediatricsApi.getImmunizations(patientId.value)
    immunizations.value = res.data
    toast.success('Dose removed')
  }

  async function storeMilestone(payload: StoreMilestonePayload): Promise<void> {
    if (!patientId.value) return
    await pediatricsApi.storeMilestone(patientId.value, payload)
    const res = await pediatricsApi.getMilestones(patientId.value)
    milestones.value = res.data
    toast.success('Milestone recorded')
  }

  async function deleteMilestone(assessmentUuid: string): Promise<void> {
    if (!patientId.value) return
    await pediatricsApi.deleteMilestone(patientId.value, assessmentUuid)
    const res = await pediatricsApi.getMilestones(patientId.value)
    milestones.value = res.data
    toast.success('Milestone removed')
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
    // Pediatrics
    birthHistory.value = null
    immunizations.value = null
    growthHistory.value = []
    milestones.value = null
    // OB-GYN
    gynProfile.value = null
    pregnancies.value = []
    currentPregnancy.value = null
    pregnancyDashboard.value = null
    pregnancyVisits.value = []
    prenatalChecklist.value = []
    // Flags
    isLoading.value = false
    isLoadingCore.value = false
    isLoadingFM.value = false
    isLoadingPeds.value = false
    isLoadingObgyn.value = false
    isSavingObgyn.value = false
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
    loadSpecialty,
    uploadAvatar,
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

    // State — OB-GYN
    gynProfile,
    pregnancies,
    currentPregnancy,
    pregnancyDashboard,
    pregnancyVisits,
    prenatalChecklist,
    activePregnancy,
    isLoadingObgyn,
    isSavingObgyn,

    // Actions — OB-GYN
    loadObgyn,
    updateGynProfile,
    createPregnancy,
    updatePregnancy,
    deletePregnancy,
    loadPregnancyDetail,
    reloadChecklist,
    toggleChecklistItem,
    reloadDashboard,
    evaluateRisk,

    // State — Pediatrics
    birthHistory,
    immunizations,
    growthHistory,
    milestones,
    isLoadingPeds,

    // Actions — Pediatrics
    loadPediatrics,
    updateBirthHistory,
    recordDose,
    deleteDose,
    storeMilestone,
    deleteMilestone,

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
