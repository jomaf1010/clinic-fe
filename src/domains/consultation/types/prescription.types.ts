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
  quantity: number | null
  is_multi_dose: boolean
  doses_per_unit: number | null
  dispensed_quantity: number | null
  out_of_stock: boolean
}

export interface PrescriptionResponse {
  id: string
  encounter_id: string
  clinic_id: string
  created_by: string
  items: PrescriptionItem[]
  created_at: string
  updated_at: string
}
