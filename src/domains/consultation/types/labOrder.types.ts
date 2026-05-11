export interface LabOrderItem {
  id: string
  description: string
  status: 'pending' | 'completed'
  instruction: string | null
  result_files: string[]
}

export interface LabOrderResponse {
  id: string
  encounter_id: string
  clinic_id: string
  created_by: string
  status: 'pending' | 'completed'
  items: LabOrderItem[]
  created_at: string
  updated_at: string
}

export interface SystemLabItem {
  name: string
  category: string
  source?: 'clinic' | 'system'
}
