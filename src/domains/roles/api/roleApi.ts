import { http } from '@/lib/http'
import type {
  RoleListResponse,
  PermissionsResponse,
  CreateRolePayload,
  UpdateRolePayload,
  ClinicRole,
} from '../types/role.types'

export const roleApi = {
  async list(): Promise<RoleListResponse> {
    return http.get<RoleListResponse>('/clinic/roles')
  },

  async permissions(): Promise<PermissionsResponse> {
    return http.get<PermissionsResponse>('/clinic/roles/permissions')
  },

  async create(data: CreateRolePayload): Promise<{ data: ClinicRole }> {
    return http.post<{ data: ClinicRole }>('/clinic/roles', data)
  },

  async update(id: string, data: UpdateRolePayload): Promise<{ data: ClinicRole }> {
    return http.patch<{ data: ClinicRole }>(`/clinic/roles/${id}`, data)
  },

  async remove(id: string): Promise<void> {
    await http.delete(`/clinic/roles/${id}`)
  },
}
