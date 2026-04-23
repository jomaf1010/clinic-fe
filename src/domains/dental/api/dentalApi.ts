import { http } from '@/lib/http'
import type {
  DentalProfile,
  DentalTreatmentPlan,
  DentalVisitDetail,
  UpsertDentalProfilePayload,
  CreateTreatmentPlanPayload,
  UpdateTreatmentPlanPayload,
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
}
