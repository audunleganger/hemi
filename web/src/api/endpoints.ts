import { api, request } from './client'
import type { AdminUserCreate, AdminUserUpdate, BackupResult, HealthResponse, LoginResult, SetupInput, SetupStatus, UserDto } from './types.gen'

export const health = () => request<HealthResponse>('/api/health')

// Account
export const setupStatus = () => api<SetupStatus>('/setup')
export const setup = (input: SetupInput) => api<LoginResult>('/setup', { method: 'POST', body: input })
export const login = (username: string, password: string) =>
  api<LoginResult>('/auth/login', { method: 'POST', body: { username, password } })
export const logout = () => api<void>('/auth/logout', { method: 'POST' })
export const me = () => api<UserDto>('/me')
export const changePassword = (currentPassword: string, newPassword: string) =>
  api<void>('/me/password', { method: 'PUT', body: { currentPassword, newPassword } })
export const setLocale = (locale: string) => api<UserDto>('/me/locale', { method: 'PUT', body: { locale } })

// Admin
export const listUsers = () => api<UserDto[]>('/admin/users')
export const createUser = (input: AdminUserCreate) => api<UserDto>('/admin/users', { method: 'POST', body: input })
export const updateUser = (id: number, input: AdminUserUpdate) =>
  api<UserDto>(`/admin/users/${id}`, { method: 'PATCH', body: input })
export const backup = () => api<BackupResult>('/admin/backup', { method: 'POST' })
