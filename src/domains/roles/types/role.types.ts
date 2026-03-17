export interface ClinicRole {
  id: string
  name: string
  slug: string
  permissions: string[]
  is_default: boolean
  created_at: string
}

export interface PermissionItem {
  key: string
  label: string
}

export interface PermissionGroup {
  label: string
  permissions: PermissionItem[]
}

export type PermissionGroupMap = Record<string, PermissionGroup>

export interface RoleListResponse {
  data: ClinicRole[]
}

export interface PermissionsResponse {
  data: PermissionGroupMap
}

export interface CreateRolePayload {
  name: string
  permissions: string[]
}

export interface UpdateRolePayload {
  name: string
  permissions: string[]
}
