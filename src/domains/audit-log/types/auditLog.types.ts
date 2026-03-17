export interface AuditLogResponse {
  id: string
  user_id: string
  user_name: string
  user_email: string
  action: 'created' | 'updated' | 'deleted' | 'login_success'
  entity_type: string
  entity_id: string
  entity_label: string
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  changed_fields: string[]
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

export interface AuditLogListResponse {
  data: AuditLogResponse[]
  meta: {
    pagination: {
      page: number
      per_page: number
      total: number
      last_page: number
    }
  }
}

export interface AuditLogDetailResponse {
  data: AuditLogResponse
}
