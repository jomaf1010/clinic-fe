export interface TeamMember {
  id: string
  user_id: string | null
  role: string
  status: 'active' | 'pending' | 'disabled' | 'removed'
  invited_email: string | null
  user: {
    name: string | null
    email: string | null
    avatar_url: string | null
  }
  created_at: string
  invited_at: string | null
  disabled_at: string | null
}

export interface TeamMemberListResponse {
  data: TeamMember[]
}

export interface InviteMemberPayload {
  email: string
  role: string
}

export interface ChangeRolePayload {
  role: string
}
