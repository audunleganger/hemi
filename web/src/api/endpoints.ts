import { api, apiDataUrl, request } from './client'
import type {
  AdminUserCreate,
  AdminUserUpdate,
  AttackDto,
  DiscardInput,
  DiscardResult,
  AttackStatus,
  AttackSummary,
  AttackUpdate,
  BackupResult,
  CalendarView,
  DayView,
  DoseDto,
  DoseInput,
  DosePreview,
  DosePreviewInput,
  EndInput,
  FeedDto,
  HealthResponse,
  HomeView,
  IngredientDto,
  IngredientInput,
  LimitDto,
  LimitInput,
  LogAfterwardsInput,
  LoginResult,
  MedicationDto,
  MedicationImageData,
  MedicationInput,
  RateInput,
  RatingSuggestion,
  ReadingInput,
  EpisodeInput,
  SettingsDto,
  SettingsInput,
  SetupInput,
  SetupStatus,
  StartAttackInput,
  StartAttackResult,
  SymptomDto,
  TriggerDto,
  WarningSignDto,
  WarningSignInput,
  UserDto,
  WorkImpact,
} from './types.gen'

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

// Settings
export const settings = () => api<SettingsDto>('/settings')
export const updateSettings = (input: SettingsInput) => api<SettingsDto>('/settings', { method: 'PUT', body: input })
export const setTimeZone = (timeZone: string) => api<SettingsDto>('/settings/time-zone', { method: 'PUT', body: { timeZone } })
export const feed = () => api<FeedDto>('/settings/feed')
export const newFeed = () => api<FeedDto>('/settings/feed', { method: 'POST' })
export const disableFeed = () => api<void>('/settings/feed', { method: 'DELETE' })

// Ingredients and limits
export const listIngredients = (includeArchived = false) => api<IngredientDto[]>('/ingredients', { query: { includeArchived } })
export const createIngredient = (input: IngredientInput) => api<IngredientDto>('/ingredients', { method: 'POST', body: input })
export const updateIngredient = (id: number, input: IngredientInput) => api<IngredientDto>(`/ingredients/${id}`, { method: 'PUT', body: input })
export const archiveIngredient = (id: number, archived: boolean) =>
  api<IngredientDto>(`/ingredients/${id}/${archived ? 'archive' : 'unarchive'}`, { method: 'POST' })
export const deleteIngredient = (id: number) => api<void>(`/ingredients/${id}`, { method: 'DELETE' })
export const createLimit = (input: LimitInput) => api<LimitDto>('/limits', { method: 'POST', body: input })
export const updateLimit = (id: number, input: LimitInput) => api<LimitDto>(`/limits/${id}`, { method: 'PUT', body: input })
export const deleteLimit = (id: number) => api<void>(`/limits/${id}`, { method: 'DELETE' })

// Medications
export const listMedications = (includeArchived = false) => api<MedicationDto[]>('/medications', { query: { includeArchived } })
export const medication = (id: number) => api<MedicationDto>(`/medications/${id}`)
export const createMedication = (input: MedicationInput) => api<MedicationDto>('/medications', { method: 'POST', body: input })
export const updateMedication = (id: number, input: MedicationInput) => api<MedicationDto>(`/medications/${id}`, { method: 'PUT', body: input })
export const archiveMedication = (id: number, archived: boolean) =>
  api<MedicationDto>(`/medications/${id}/${archived ? 'archive' : 'unarchive'}`, { method: 'POST' })
export const deleteMedication = (id: number) => api<void>(`/medications/${id}`, { method: 'DELETE' })
export const medicationImage = (id: number, version: number, size: 'full' | 'thumbnail') =>
  apiDataUrl(`/medications/${id}/image`, { v: version, size })
export const setMedicationImage = (id: number, data: MedicationImageData) =>
  api<MedicationDto>(`/medications/${id}/image`, { method: 'PUT', body: data })
export const deleteMedicationImage = (id: number) => api<MedicationDto>(`/medications/${id}/image`, { method: 'DELETE' })

// Triggers
export const listTriggers = (includeArchived = false) => api<TriggerDto[]>('/triggers', { query: { includeArchived } })
export const createTrigger = (name: string) => api<TriggerDto>('/triggers', { method: 'POST', body: { name } })
export const renameTrigger = (id: number, name: string) => api<TriggerDto>(`/triggers/${id}`, { method: 'PUT', body: { name } })
export const reorderTriggers = (ids: number[]) => api<TriggerDto[]>('/triggers/order', { method: 'PUT', body: { ids } })
export const archiveTrigger = (id: number, archived: boolean) =>
  api<TriggerDto>(`/triggers/${id}/${archived ? 'archive' : 'unarchive'}`, { method: 'POST' })
export const deleteTrigger = (id: number) => api<void>(`/triggers/${id}`, { method: 'DELETE' })

// Symptoms for warning signs (WS-2)
export const listSymptoms = (includeArchived = false) => api<SymptomDto[]>('/symptoms', { query: { includeArchived } })
export const createSymptom = (name: string) => api<SymptomDto>('/symptoms', { method: 'POST', body: { name } })
export const renameSymptom = (id: number, name: string) => api<SymptomDto>(`/symptoms/${id}`, { method: 'PUT', body: { name } })
export const reorderSymptoms = (ids: number[]) => api<SymptomDto[]>('/symptoms/order', { method: 'PUT', body: { ids } })
export const archiveSymptom = (id: number, archived: boolean) =>
  api<SymptomDto>(`/symptoms/${id}/${archived ? 'archive' : 'unarchive'}`, { method: 'POST' })
export const deleteSymptom = (id: number) => api<void>(`/symptoms/${id}`, { method: 'DELETE' })

// Home, calendar and days
export const home = () => api<HomeView>('/home')
export const calendar = (from: string, to: string, includeUnsure = true) => api<CalendarView>('/calendar', { query: { from, to, includeUnsure } })
export const day = (date: string) => api<DayView>(`/days/${date}`)
export const setWorkImpact = (date: string, impact: WorkImpact | null) =>
  api<DayView>(`/days/${date}/work-impact`, { method: 'PUT', body: { impact } })

// Attacks
export interface AttackQuery {
  status?: AttackStatus[]
  peak?: number
  triggerId?: number
  medicationId?: number
  from?: string
  to?: string
}
export const listAttacks = (q: AttackQuery = {}) => api<AttackSummary[]>('/attacks', { query: { ...q, status: q.status?.join(',') } })
export const attack = (id: number) => api<AttackDto>(`/attacks/${id}`)
export const startAttack = (input: StartAttackInput) => api<StartAttackResult>('/attacks/start', { method: 'POST', body: input })
export const logAfterwards = (input: LogAfterwardsInput) => api<AttackDto>('/attacks/afterwards', { method: 'POST', body: input })
export const updateAttack = (id: number, input: AttackUpdate) => api<AttackDto>(`/attacks/${id}`, { method: 'PUT', body: input })
export const deleteAttack = (id: number) => api<void>(`/attacks/${id}`, { method: 'DELETE' })
export const discardAttack = (id: number, input: DiscardInput) => api<DiscardResult>(`/attacks/${id}/discard`, { method: 'POST', body: input })
export const endAttack = (id: number, input: EndInput = {}) => api<AttackDto>(`/attacks/${id}/end`, { method: 'POST', body: input })
export const addReading = (id: number, input: ReadingInput) => api<AttackDto>(`/attacks/${id}/readings`, { method: 'POST', body: input })
export const updateReading = (id: number, readingId: number, input: ReadingInput) =>
  api<AttackDto>(`/attacks/${id}/readings/${readingId}`, { method: 'PUT', body: input })
export const deleteReading = (id: number, readingId: number) => api<AttackDto>(`/attacks/${id}/readings/${readingId}`, { method: 'DELETE' })
export const updateEpisode = (id: number, episodeId: number, input: EpisodeInput) =>
  api<AttackDto>(`/attacks/${id}/episodes/${episodeId}`, { method: 'PUT', body: input })
export const deleteEpisode = (id: number, episodeId: number) => api<AttackDto>(`/attacks/${id}/episodes/${episodeId}`, { method: 'DELETE' })
export const splitEpisode = (id: number, episodeId: number) => api<AttackDto>(`/attacks/${id}/episodes/${episodeId}/split`, { method: 'POST' })

// Warning signs (WS-1 … WS-5)
export const listSigns = (q: { from?: string; to?: string } = {}) => api<WarningSignDto[]>('/signs', { query: { ...q } })
export const createSign = (input: WarningSignInput) => api<WarningSignDto>('/signs', { method: 'POST', body: input })
export const updateSign = (id: number, input: WarningSignInput) => api<WarningSignDto>(`/signs/${id}`, { method: 'PUT', body: input })
export const deleteSign = (id: number) => api<void>(`/signs/${id}`, { method: 'DELETE' })

// Doses
export interface DoseQuery {
  medicationId?: number
  ingredientId?: number
  rated?: boolean
  withAttack?: boolean
  from?: string
  to?: string
}
export const listDoses = (q: DoseQuery = {}) => api<DoseDto[]>('/doses', { query: { ...q } })
export const createDose = (input: DoseInput) => api<DoseDto>('/doses', { method: 'POST', body: input })
export const previewDose = (input: DosePreviewInput) => api<DosePreview>('/doses/preview', { method: 'POST', body: input })
export const updateDose = (id: number, input: DoseInput) => api<DoseDto>(`/doses/${id}`, { method: 'PUT', body: input })
export const rateDose = (id: number, input: RateInput) => api<DoseDto>(`/doses/${id}/rate`, { method: 'POST', body: input })
export const dismissRating = (id: number) => api<DoseDto>(`/doses/${id}/dismiss`, { method: 'POST' })
export const ratingSuggestion = (id: number, severity: number) => api<RatingSuggestion>(`/doses/${id}/suggestion`, { query: { severity } })
export const deleteDose = (id: number) => api<void>(`/doses/${id}`, { method: 'DELETE' })
