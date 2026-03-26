import { http } from '@/lib/http'
import type { LoginCredentials, LoginResponse, MeResponse, MessageResponse, RefreshResponse, SelectClinicResponse, SignupCredentials, SignupResponse, VerifyEmailPayload } from '../types/auth.types'

export const authApi = {
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    return http.post<LoginResponse>('/auth/login', {
      ...credentials,
      password: btoa(credentials.password),
    })
  },

  async signup(credentials: SignupCredentials): Promise<SignupResponse> {
    return http.post<SignupResponse>('/auth/signup', {
      ...credentials,
      password: btoa(credentials.password),
    })
  },

  async verifyEmail(payload: VerifyEmailPayload): Promise<MessageResponse> {
    return http.post<MessageResponse>('/auth/verify-email', payload)
  },

  async resendVerification(payload: { email: string }): Promise<MessageResponse> {
    return http.post<MessageResponse>('/auth/resend-verification', payload)
  },

  async me(): Promise<MeResponse> {
    return http.get<MeResponse>('/auth/me')
  },

  async selectClinic(clinicId: string): Promise<SelectClinicResponse> {
    return http.post<SelectClinicResponse>('/auth/select-clinic', { clinic_id: clinicId })
  },

  async updatePreferences(data: { theme: 'light' | 'dark' }): Promise<void> {
    await http.patch('/auth/preferences', data)
  },

  async updateProfile(data: Record<string, unknown>): Promise<void> {
    await http.patch('/auth/profile', data)
  },

  async changePassword(data: { current_password: string; new_password: string; new_password_confirmation: string }): Promise<void> {
    await http.put('/auth/password', data)
  },

  async uploadAvatar(file: File): Promise<{ data: { avatar_url: string } }> {
    const formData = new FormData()
    formData.append('avatar', file)
    return http.upload('/auth/avatar', formData)
  },

  async refresh(): Promise<RefreshResponse> {
    const BASE_URL = import.meta.env.VITE_API_URL as string
    const response = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      credentials: 'include',
    })
    if (!response.ok) {
      throw new Error('Refresh failed')
    }
    return response.json()
  },

  async logout(): Promise<void> {
    const BASE_URL = import.meta.env.VITE_API_URL as string
    const token = localStorage.getItem('auth_token')
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    try {
      await fetch(`${BASE_URL}/auth/logout`, {
        method: 'POST',
        headers,
        credentials: 'include',
      })
    } catch {
      // Best-effort — server might be unreachable
    }
  },

  async forgotPassword(email: string): Promise<MessageResponse> {
    return http.post<MessageResponse>('/auth/forgot-password', { email })
  },

  async resetPassword(data: { email: string; token: string; password: string; password_confirmation: string }): Promise<MessageResponse> {
    return http.post<MessageResponse>('/auth/reset-password', {
      ...data,
      password: btoa(data.password),
      password_confirmation: btoa(data.password_confirmation),
    })
  },

  async heartbeat(): Promise<void> {
    await http.post('/auth/heartbeat', {})
  },

  async onlineUsers(): Promise<{ data: string[] }> {
    return http.get<{ data: string[] }>('/auth/online-users')
  },
}
