export interface PrescriptionItem {
  id: string
  drug_name: string
  dose: string
  frequency: string
  duration: string
  route: string
  instructions: string | null
  medicine_id: string | null
  unit_price: number | null
}

export interface PrescriptionResponse {
  id: string
  consultation_id: string
  clinic_id: string
  created_by: string
  items: PrescriptionItem[]
  created_at: string
  updated_at: string
}
