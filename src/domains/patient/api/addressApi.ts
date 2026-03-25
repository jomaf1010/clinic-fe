import { http } from '@/lib/http'

export interface AddressOption {
  code: string
  name: string
}

interface AddressLookupResponse {
  data: AddressOption[]
}

export const addressApi = {
  lookup(type: string, parentCode?: string): Promise<AddressLookupResponse> {
    const params = new URLSearchParams({ type })
    if (parentCode) params.set('parent_code', parentCode)
    return http.get<AddressLookupResponse>(`/address/lookup?${params.toString()}`)
  },
}
