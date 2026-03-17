import { http } from '@/lib/http'
import type { AuditLogDetailResponse, AuditLogListResponse } from '../types/auditLog.types'

export const auditLogApi = {
  list(page = 1, perPage = 15): Promise<AuditLogListResponse> {
    return http.get<AuditLogListResponse>(`/audit-logs?page=${page}&per_page=${perPage}`)
  },

  get(uuid: string): Promise<AuditLogDetailResponse> {
    return http.get<AuditLogDetailResponse>(`/audit-logs/${uuid}`)
  },
}
