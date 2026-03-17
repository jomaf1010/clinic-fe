import { http } from '@/lib/http'
import type { LabOrderResponse, SystemLabItem } from '../types/labOrder.types'

const API_URL = import.meta.env.VITE_API_URL as string

export const labOrderApi = {
  getForConsultation(consultationId: string): Promise<{ data: LabOrderResponse }> {
    return http.get<{ data: LabOrderResponse }>(`/consultations/${consultationId}/lab-order`)
  },

  create(
    consultationId: string,
    items: { description: string; instruction?: string }[],
  ): Promise<{ data: LabOrderResponse }> {
    return http.post<{ data: LabOrderResponse }>(`/consultations/${consultationId}/lab-order`, {
      items,
    })
  },

  addItem(
    labOrderId: string,
    payload: { description: string; instruction?: string },
  ): Promise<{ data: LabOrderResponse }> {
    return http.post<{ data: LabOrderResponse }>(`/lab-orders/${labOrderId}/items`, payload)
  },

  updateItem(
    labOrderId: string,
    itemId: string,
    payload: { description?: string; instruction?: string },
  ): Promise<{ data: LabOrderResponse }> {
    return http.patch<{ data: LabOrderResponse }>(
      `/lab-orders/${labOrderId}/items/${itemId}`,
      payload,
    )
  },

  removeItem(labOrderId: string, itemId: string): Promise<{ data: LabOrderResponse }> {
    return http.delete<{ data: LabOrderResponse }>(`/lab-orders/${labOrderId}/items/${itemId}`)
  },

  uploadResult(
    labOrderId: string,
    itemId: string,
    file: File,
  ): Promise<{ data: LabOrderResponse }> {
    const token = localStorage.getItem('auth_token')
    const formData = new FormData()
    formData.append('file', file)

    return fetch(`${API_URL}/lab-orders/${labOrderId}/items/${itemId}/result`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    }).then(async (response) => {
      const data = await response.json()
      if (!response.ok) {
        throw new Error(`Upload failed with status ${response.status}`)
      }
      return data as { data: LabOrderResponse }
    })
  },

  searchSystemItems(query: string): Promise<{ data: SystemLabItem[] }> {
    return http.get<{ data: SystemLabItem[] }>(
      `/system/lab-items?q=${encodeURIComponent(query)}`,
    )
  },
}
