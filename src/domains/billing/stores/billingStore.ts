import { defineStore } from 'pinia'
import { ref } from 'vue'
import { toast } from 'vue-sonner'
import { billingApi } from '../api/billingApi'
import type {
  BillingSummary,
  CreateInvoicePayload,
  InvoiceResponse,
  RecordPaymentPayload,
  UpdateInvoiceLineItemPayload,
} from '../types/billing.types'

export const useBillingStore = defineStore('billing', () => {
  const invoices = ref<InvoiceResponse[]>([])
  const currentInvoice = ref<InvoiceResponse | null>(null)
  const summary = ref<BillingSummary | null>(null)
  const isLoading = ref(false)
  const isLoadingSummary = ref(false)
  const isSaving = ref(false)
  const currentPage = ref(1)
  const lastPage = ref(1)
  const totalInvoices = ref(0)

  async function fetchInvoices(params?: { page?: number; status?: string; search?: string }): Promise<void> {
    isLoading.value = true
    try {
      const response = await billingApi.list({
        page: params?.page ?? 1,
        per_page: 10,
        status: params?.status,
        search: params?.search,
      })
      invoices.value = response.data
      currentPage.value = response.meta.pagination.page
      lastPage.value = response.meta.pagination.last_page
      totalInvoices.value = response.meta.pagination.total
    } finally {
      isLoading.value = false
    }
  }

  async function fetchInvoice(id: string): Promise<void> {
    isLoading.value = true
    try {
      const response = await billingApi.get(id)
      currentInvoice.value = response.data
    } finally {
      isLoading.value = false
    }
  }

  async function fetchForConsultation(consultationId: string): Promise<InvoiceResponse | null> {
    try {
      const response = await billingApi.forConsultation(consultationId)
      currentInvoice.value = response.data
      return response.data
    } catch {
      currentInvoice.value = null
      return null
    }
  }

  async function fetchSummary(): Promise<void> {
    isLoadingSummary.value = true
    try {
      const response = await billingApi.summary()
      summary.value = response.data
    } finally {
      isLoadingSummary.value = false
    }
  }

  async function createInvoice(payload: CreateInvoicePayload): Promise<InvoiceResponse> {
    isSaving.value = true
    try {
      const response = await billingApi.create(payload)
      toast.success('Invoice created')
      return response.data
    } finally {
      isSaving.value = false
    }
  }

  async function updateInvoice(invoiceId: string, lineItems: UpdateInvoiceLineItemPayload[]): Promise<void> {
    isSaving.value = true
    try {
      const response = await billingApi.update(invoiceId, { line_items: lineItems })
      currentInvoice.value = response.data
      const index = invoices.value.findIndex((i) => i.id === invoiceId)
      if (index !== -1) invoices.value[index] = response.data
      toast.success('Invoice updated')
    } finally {
      isSaving.value = false
    }
  }

  async function recordPayment(invoiceId: string, payload: RecordPaymentPayload): Promise<void> {
    isSaving.value = true
    try {
      const response = await billingApi.recordPayment(invoiceId, payload)
      currentInvoice.value = response.data
      // Update in list if present
      const index = invoices.value.findIndex((i) => i.id === invoiceId)
      if (index !== -1) invoices.value[index] = response.data
      toast.success('Payment recorded')
    } finally {
      isSaving.value = false
    }
  }

  async function voidInvoice(invoiceId: string, reason: string): Promise<void> {
    isSaving.value = true
    try {
      const response = await billingApi.void(invoiceId, { reason })
      currentInvoice.value = response.data
      const index = invoices.value.findIndex((i) => i.id === invoiceId)
      if (index !== -1) invoices.value[index] = response.data
      toast.success('Invoice voided')
    } finally {
      isSaving.value = false
    }
  }

  async function requestMedCert(invoiceId: string): Promise<void> {
    isSaving.value = true
    try {
      const response = await billingApi.requestMedCert(invoiceId)
      currentInvoice.value = response.data
      const index = invoices.value.findIndex((i) => i.id === invoiceId)
      if (index !== -1) invoices.value[index] = response.data
      toast.success('Medical certificate requested')
    } finally {
      isSaving.value = false
    }
  }

  function clearCurrent(): void {
    currentInvoice.value = null
  }

  return {
    invoices,
    currentInvoice,
    summary,
    isLoading,
    isLoadingSummary,
    isSaving,
    currentPage,
    lastPage,
    totalInvoices,
    fetchInvoices,
    fetchInvoice,
    fetchForConsultation,
    fetchSummary,
    createInvoice,
    updateInvoice,
    recordPayment,
    voidInvoice,
    requestMedCert,
    clearCurrent,
  }
})
