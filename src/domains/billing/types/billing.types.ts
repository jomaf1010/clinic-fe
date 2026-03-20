export type InvoiceStatus = 'unpaid' | 'partial' | 'paid' | 'void'
export type PaymentMethod = 'cash' | 'gcash'
export type LineItemType = 'consultation_fee' | 'medicine' | 'consumable' | 'lab_service' | 'custom'
export type DiscountType = 'percentage' | 'fixed'

export interface InvoiceLineItem {
  id: string
  type: LineItemType
  description: string
  reference_id: string | null
  quantity: number
  unit_price: number
  subtotal: number
  price_breakdown: string | null
  price_per_piece?: number | null
  price_per_pack?: number | null
  quantity_per_pack?: number | null
}

export interface InvoicePayment {
  id: string
  amount: number
  method: PaymentMethod
  reference_number: string | null
  notes: string | null
  received_by: string | null
  received_by_name: string | null
  paid_at: string
}

export interface InvoiceResponse {
  id: string
  clinic_id: string
  patient_id: string
  consultation_id: string | null
  patient_name: string | null
  created_by: string
  created_by_name: string | null
  invoice_number: string
  line_items: InvoiceLineItem[]
  subtotal: number
  discount_type: DiscountType | null
  discount_value: number | null
  discount_amount: number
  total: number
  amount_paid: number
  balance: number
  payments: InvoicePayment[]
  status: InvoiceStatus
  notes: string | null
  void_reason: string | null
  voided_by: string | null
  voided_by_name: string | null
  voided_at: string | null
  created_at: string
  updated_at: string
}

export interface InvoiceListResponse {
  data: InvoiceResponse[]
  meta: {
    pagination: {
      page: number
      per_page: number
      total: number
      last_page: number
    }
  }
}

export interface InvoiceDetailResponse {
  data: InvoiceResponse
}

export interface BillingSummary {
  total_revenue_this_month: number
  outstanding_balance: number
  invoices_today: number
  paid_today: number
}

export interface BillingSummaryResponse {
  data: BillingSummary
}

export interface CreateInvoiceLineItemPayload {
  type: LineItemType
  description: string
  reference_id?: string | null
  quantity: number
  unit_price: number
}

export interface CreateInvoicePayload {
  patient_id: string
  consultation_id?: string | null
  line_items: CreateInvoiceLineItemPayload[]
  discount_type?: DiscountType | null
  discount_value?: number | null
  notes?: string | null
}

export interface RecordPaymentPayload {
  amount: number
  method: PaymentMethod
  reference_number?: string | null
  notes?: string | null
}

export interface UpdateInvoiceLineItemPayload {
  id: string
  quantity: number
}

export interface UpdateInvoicePayload {
  line_items: UpdateInvoiceLineItemPayload[]
}

export interface VoidInvoicePayload {
  reason: string
}
