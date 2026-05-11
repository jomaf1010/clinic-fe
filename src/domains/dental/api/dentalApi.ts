import { http } from '@/lib/http'
import type {
  DentalProfile,
  DentalServiceCatalogEntry,
  DentalToothHistory,
  DentalTreatmentPlan,
  DentalVisitDetail,
  UpsertDentalProfilePayload,
  CreateTreatmentPlanPayload,
  UpdateTreatmentPlanPayload,
  UpdateDentalServicePayload,
  UpdateDoctorDentalServicePayload,
  UpdateDentalVisitPayload,
} from '../types/dental.types'

export const dentalApi = {
  // Profile (patient-level baseline + authoritative odontogram)
  getProfile(patientId: string): Promise<{ data: DentalProfile }> {
    return http.get(`/patients/${patientId}/dental-profile`) as Promise<{ data: DentalProfile }>
  },
  updateProfile(patientId: string, payload: UpsertDentalProfilePayload): Promise<{ data: DentalProfile }> {
    return http.put(`/patients/${patientId}/dental-profile`, payload) as Promise<{ data: DentalProfile }>
  },

  // Treatment Plans (phased episodes)
  listTreatmentPlans(patientId: string): Promise<{ data: DentalTreatmentPlan[] }> {
    return http.get(`/patients/${patientId}/dental-treatment-plans`) as Promise<{ data: DentalTreatmentPlan[] }>
  },
  showTreatmentPlan(patientId: string, planId: string): Promise<{ data: DentalTreatmentPlan }> {
    return http.get(`/patients/${patientId}/dental-treatment-plans/${planId}`) as Promise<{ data: DentalTreatmentPlan }>
  },
  createTreatmentPlan(patientId: string, payload: CreateTreatmentPlanPayload): Promise<{ data: DentalTreatmentPlan }> {
    return http.post(`/patients/${patientId}/dental-treatment-plans`, payload) as Promise<{ data: DentalTreatmentPlan }>
  },
  updateTreatmentPlan(patientId: string, planId: string, payload: UpdateTreatmentPlanPayload): Promise<{ data: DentalTreatmentPlan }> {
    return http.patch(`/patients/${patientId}/dental-treatment-plans/${planId}`, payload) as Promise<{ data: DentalTreatmentPlan }>
  },
  deleteTreatmentPlan(patientId: string, planId: string): Promise<void> {
    return http.delete(`/patients/${patientId}/dental-treatment-plans/${planId}`) as Promise<void>
  },

  // Visits — created via Encounter flow with type=dental, but read/update directly here
  listVisits(patientId: string, treatmentPlanId?: string): Promise<{ data: DentalVisitDetail[] }> {
    const qs = treatmentPlanId ? `?treatment_plan_id=${encodeURIComponent(treatmentPlanId)}` : ''
    return http.get(`/patients/${patientId}/dental-visits${qs}`) as Promise<{ data: DentalVisitDetail[] }>
  },
  showVisit(patientId: string, visitId: string): Promise<{ data: DentalVisitDetail }> {
    return http.get(`/patients/${patientId}/dental-visits/${visitId}`) as Promise<{ data: DentalVisitDetail }>
  },
  updateVisit(patientId: string, visitId: string, payload: UpdateDentalVisitPayload): Promise<{ data: DentalVisitDetail }> {
    return http.patch(`/patients/${patientId}/dental-visits/${visitId}`, payload) as Promise<{ data: DentalVisitDetail }>
  },
  deleteVisit(patientId: string, visitId: string): Promise<void> {
    return http.delete(`/patients/${patientId}/dental-visits/${visitId}`) as Promise<void>
  },

  // Service catalog / fee schedule (clinic-wide defaults)
  listServices(): Promise<{ data: DentalServiceCatalogEntry[] }> {
    return http.get('/dental/services') as Promise<{ data: DentalServiceCatalogEntry[] }>
  },
  updateService(clinicServiceUuid: string, payload: UpdateDentalServicePayload): Promise<{ data: DentalServiceCatalogEntry }> {
    return http.patch(`/dental/services/${clinicServiceUuid}`, payload) as Promise<{ data: DentalServiceCatalogEntry }>
  },

  // Per-doctor overrides on the active clinic's catalog. Returns the same
  // catalog rows but with `override_price` / `override_is_active` populated
  // from the dentist's `DoctorService` rows and `effective_*` computed.
  listMyServices(): Promise<{ data: DentalServiceCatalogEntry[] }> {
    return http.get('/me/dental/services') as Promise<{ data: DentalServiceCatalogEntry[] }>
  },
  updateMyService(clinicServiceUuid: string, payload: UpdateDoctorDentalServicePayload): Promise<{ data: DentalServiceCatalogEntry }> {
    return http.patch(`/me/dental/services/${clinicServiceUuid}`, payload) as Promise<{ data: DentalServiceCatalogEntry }>
  },

  // Per-tooth history (aggregated across profile, visits, and treatment plans)
  toothHistory(patientId: string, tooth: string): Promise<{ data: DentalToothHistory }> {
    const qs = new URLSearchParams({ tooth }).toString()
    return http.get(`/patients/${patientId}/dental-history?${qs}`) as Promise<{ data: DentalToothHistory }>
  },
}
