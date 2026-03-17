import { http } from '@/lib/http'
import type { LoginCredentials, LoginResponse, MeResponse, MessageResponse, SelectClinicResponse, SignupCredentials, SignupResponse, VerifyEmailPayload } from '../types/auth.types'

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
}
