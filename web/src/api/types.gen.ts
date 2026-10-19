// Generated from the Kotlin API types in shared/ by TypeScriptTypesTest. Do not edit.
// Regenerate: ./gradlew :shared:test -PupdateTsTypes=true

export const API_VERSION = 1

export const ErrorCodes = {
  VALIDATION: 'VALIDATION',
  NAME_REQUIRED: 'NAME_REQUIRED',
  NAME_TAKEN: 'NAME_TAKEN',
  NOT_FOUND: 'NOT_FOUND',
  REFERENCED: 'REFERENCED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  SETUP_DONE: 'SETUP_DONE',
  LAST_ADMIN: 'LAST_ADMIN',
  WEAK_PASSWORD: 'WEAK_PASSWORD',
  INVALID_IMPORT: 'INVALID_IMPORT',
} as const

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes]


export interface AdminUserCreate {
  username: string
  password: string
  isAdmin?: boolean
  locale?: string | null
}

export interface AdminUserUpdate {
  isAdmin?: boolean | null
  isDisabled?: boolean | null
  password?: string | null
}

export interface BackupResult {
  file: string
  sizeBytes: number
}

export interface ErrorResponse {
  error: string
  message: string
  details?: Record<string, number>
}

export interface HealthResponse {
  status: string
  version: string
  apiVersion: number
}

export interface LocaleInput {
  locale: string
}

export interface LoginInput {
  username: string
  password: string
}

export interface LoginResult {
  token: string
  user: UserDto
}

export interface PasswordChangeInput {
  currentPassword: string
  newPassword: string
}

export interface SetupInput {
  username: string
  password: string
  locale?: string | null
}

export interface SetupStatus {
  needsSetup: boolean
}

export interface UserDto {
  id: number
  username: string
  isAdmin: boolean
  isDisabled: boolean
  locale: string | null
  createdAt: number
}
