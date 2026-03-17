import { http } from '@/lib/http'
import type { PrescriptionResponse } from '../types/prescription.types'

export const prescriptionApi = {
  getForConsultation(consultationId: string): Promise<{ data: PrescriptionResponse }> {
    return http.get<{ data: PrescriptionResponse }>(
      `/consultations/${consultationId}/prescription`,
    )
  },

  create(
    consultationId: string,
    items: {
      drug_name: string
      dose: string
      frequency: string
      duration?: string
      route?: string
      instructions?: string
      medicine_id?: string | null
      unit_price?: number | null
    }[],
  ): Promise<{ data: PrescriptionResponse }> {
    return http.post<{ data: PrescriptionResponse }>(
      `/consultations/${consultationId}/prescription`,
      { items },
    )
  },

  addItem(
    prescriptionId: string,
    payload: {
      drug_name: string
      dose: string
      frequency: string
      duration?: string
      route?: string
      instructions?: string
      medicine_id?: string | null
      unit_price?: number | null
    },
  ): Promise<{ data: PrescriptionResponse }> {
    return http.post<{ data: PrescriptionResponse }>(
      `/prescriptions/${prescriptionId}/items`,
      payload,
    )
  },

  updateItem(
    prescriptionId: string,
    itemId: string,
    payload: Partial<{
      drug_name: string
      dose: string
      frequency: string
      duration: string
      route: string
      instructions: string | null
      medicine_id: string | null
      unit_price: number | null
    }>,
  ): Promise<{ data: PrescriptionResponse }> {
    return http.patch<{ data: PrescriptionResponse }>(
      `/prescriptions/${prescriptionId}/items/${itemId}`,
      payload,
    )
  },

  removeItem(prescriptionId: string, itemId: string): Promise<{ data: PrescriptionResponse }> {
    return http.delete<{ data: PrescriptionResponse }>(
      `/prescriptions/${prescriptionId}/items/${itemId}`,
    )
  },
}
