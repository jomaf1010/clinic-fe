interface InvoiceLineItem {
  type: 'consultation_fee' | 'medicine' | 'consumable' | 'procedure' | 'lab_service'
  description: string
  reference_id: string | null
  quantity: number
  unit_price: number
  price_breakdown?: string | null
}

interface InvoiceFixture {
  uuid: string
  id: string
  clinic_id: string
  patient_id: string
  encounter_id: string
  doctor_id: string
  invoice_number: string
  status: 'draft' | 'finalized' | 'paid' | 'void'
  line_items: InvoiceLineItem[]
  subtotal: number
  discount_type: 'percentage' | 'fixed' | null
  discount_value: number | null
  total: number
  amount_paid: number
  amount_due: number
  notes: string | null
  created_at: string
  updated_at: string
}

export function makeInvoice(overrides: Partial<InvoiceFixture> = {}): InvoiceFixture {
  const lineItems: InvoiceLineItem[] = overrides.line_items ?? [
    {
      type: 'consultation_fee',
      description: 'Consultation Fee',
      reference_id: 'user-fixture-uuid',
      quantity: 1,
      unit_price: 500,
    },
  ]
  const subtotal = lineItems.reduce((sum, li) => sum + li.unit_price * li.quantity, 0)

  return {
    uuid: 'invoice-fixture-uuid',
    id: 'invoice-fixture-uuid',
    clinic_id: 'clinic-fixture-uuid',
    patient_id: 'patient-fixture-uuid',
    encounter_id: 'encounter-fixture-uuid',
    doctor_id: 'user-fixture-uuid',
    invoice_number: 'INV-0001',
    status: 'draft',
    line_items: lineItems,
    subtotal,
    discount_type: null,
    discount_value: null,
    total: subtotal,
    amount_paid: 0,
    amount_due: subtotal,
    notes: null,
    created_at: '2026-04-30T10:00:00Z',
    updated_at: '2026-04-30T10:00:00Z',
    ...overrides,
  }
}

export function makeLineItem(overrides: Partial<InvoiceLineItem> = {}): InvoiceLineItem {
  return {
    type: 'consultation_fee',
    description: 'Consultation Fee',
    reference_id: null,
    quantity: 1,
    unit_price: 500,
    ...overrides,
  }
}
