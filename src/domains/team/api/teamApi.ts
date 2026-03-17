import { http } from '@/lib/http'
import type { TeamMemberListResponse, InviteMemberPayload, ChangeRolePayload, TeamMember } from '../types/team.types'

export const teamApi = {
  async list(params?: { status?: string; role?: string }): Promise<TeamMemberListResponse> {
    const query = new URLSearchParams()
    if (params?.status) query.set('status', params.status)
    if (params?.role) query.set('role', params.role)
    const qs = query.toString()
    return http.get<TeamMemberListResponse>(`/clinic/members${qs ? `?${qs}` : ''}`)
  },

  async invite(data: InviteMemberPayload): Promise<{ data: TeamMember }> {
    return http.post<{ data: TeamMember }>('/clinic/members/invite', data)
  },

  async resendInvite(id: string): Promise<{ message: string }> {
    return http.post<{ message: string }>(`/clinic/members/${id}/resend-invite`)
  },

  async changeRole(id: string, data: ChangeRolePayload): Promise<{ data: TeamMember }> {
    return http.patch<{ data: TeamMember }>(`/clinic/members/${id}/role`, data)
  },

  async disable(id: string): Promise<{ data: TeamMember }> {
    return http.patch<{ data: TeamMember }>(`/clinic/members/${id}/disable`)
  },

  async enable(id: string): Promise<{ data: TeamMember }> {
    return http.patch<{ data: TeamMember }>(`/clinic/members/${id}/enable`)
  },

  async remove(id: string): Promise<void> {
    await http.delete(`/clinic/members/${id}`)
  },
}
