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
  ATTACK_ONGOING: 'ATTACK_ONGOING',
} as const

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes]


export interface AcuteMedicationDays {
  count: number
  windowDays: number
  freesUpOn: string | null
}

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

export interface AttackDto {
  summary: AttackSummary
  note: string | null
  episodes: EpisodeDto[]
  readings: ReadingDto[]
  doses: DoseDto[]
  signs: WarningSignDto[]
  createdAt: number
  updatedAt: number
}

export type AttackStatus = 'migraine' | 'unsure' | 'not_migraine'

export interface AttackSummary {
  id: number
  status: AttackStatus
  loggedAfterwards: boolean
  start: Moment
  wokeUp: boolean
  end: Moment | null
  endedAsleep: boolean
  ongoing: boolean
  peak: number | null
  painSide: PainSide | null
  nausea: Nausea | null
  triggerIds: number[]
  doseCount: number
  episodeCount: number
  durationMillis: number | null
}

export interface AttackUpdate {
  status: AttackStatus
  nausea?: Nausea | null
  painSide?: PainSide | null
  note?: string | null
  triggerIds?: number[]
}

export interface BackupResult {
  file: string
  sizeBytes: number
}

export interface CalendarDay {
  date: string
  severity: number | null
  attack: boolean
  unsure: boolean
  medication: boolean
  signs: boolean
  ongoing: boolean
  workImpact: WorkImpact | null
}

export interface CalendarView {
  from: string
  to: string
  today: string
  days: CalendarDay[]
}

export interface DayReading {
  attackId: number
  reading: ReadingDto
}

export interface DayView {
  date: string
  attacks: AttackSummary[]
  readings: DayReading[]
  doses: DoseDto[]
  signs: WarningSignDto[]
  workImpact: WorkImpactDto | null
}

export interface DiscardInput {
  deleteDoses?: boolean
}

export interface DiscardResult {
  restored: AttackDto | null
}

export interface DoseDto {
  id: number
  medicationId: number
  medicationName: string
  doseUnit: string
  quantity: number
  at: Moment
  note: string | null
  attackId: number | null
  rating: Rating | null
  ratedAt: number | null
  ratingDismissed: boolean
  overLimit: boolean
  dueAt: number | null
  sustained: boolean | null
  isRemedy: boolean
  imageVersion: number | null
}

export interface DoseInput {
  medicationId: number
  quantity?: number | null
  at?: Moment | null
  note?: string | null
  attackId?: number | null
  autoAttack?: boolean
  severity?: number | null
}

export interface DosePreview {
  effects: LimitEffectDto[]
  over: boolean
}

export interface DosePreviewInput {
  medicationId: number
  quantity?: number | null
  at?: Moment | null
  doseId?: number | null
}

export interface EndInput {
  at?: Moment | null
  asleep?: boolean
}

export interface EpisodeDto {
  id: number
  start: Moment
  end: Moment | null
  startUnknown: boolean
  isRecurrence: boolean
  endUnknown: boolean
}

export interface EpisodeInput {
  start: Moment
  startUnknown?: boolean
  end?: Moment | null
  endUnknown?: boolean
}

export interface ErrorResponse {
  error: string
  message: string
  details?: Record<string, number>
}

export interface FeedDto {
  token: string | null
}

export interface HealthResponse {
  status: string
  version: string
  apiVersion: number
}

export interface HomeView {
  today: string
  ongoing: AttackDto | null
  pendingRatings: PendingRating[]
  staleAttack: StaleAttack | null
  limits: LimitStatusDto[]
  acuteMedicationDays: AcuteMedicationDays
  usualMedication: MedicationDto | null
  usualDosePreview: DosePreview | null
}

export interface IngredientDto {
  id: number
  name: string
  measureUnit: string
  archived: boolean
  medicationIds: number[]
  limits: LimitStatusDto[]
}

export interface IngredientInput {
  name: string
  measureUnit: string
}

export interface LimitDto {
  id: number
  ingredientId: number
  kind: LimitKind
  maxValue: number
  windowMinutes: number
}

export interface LimitEffectDto {
  limitId: number
  ingredientName: string
  measureUnit: string
  kind: LimitKind
  windowMinutes: number
  before: number
  after: number
  max: number
  over: boolean
  nextAllowedAt: number | null
  amountUnknown: boolean
}

export interface LimitInput {
  ingredientId: number
  kind: LimitKind
  maxValue?: number
  windowMinutes: number
}

export type LimitKind = 'amount' | 'doses' | 'days' | 'min_interval'

export type LimitState = 'ok' | 'near' | 'reached' | 'over'

export interface LimitStatusDto {
  limit: LimitDto
  ingredientName: string
  measureUnit: string
  used: number
  max: number
  state: LimitState
  freesUpAt: number | null
  freesUpOn: string | null
  nextAllowedAt: number | null
  unknownAmounts: number
}

export interface LocaleInput {
  locale: string
}

export interface LogAfterwardsInput {
  start: Moment
  end?: Moment | null
  peakSeverity?: number | null
  status?: AttackStatus
  nausea?: Nausea | null
  painSide?: PainSide | null
  triggerIds?: number[]
  note?: string | null
  doses?: PastDoseInput[]
}

export interface LoginInput {
  username: string
  password: string
}

export interface LoginResult {
  token: string
  user: UserDto
}

export interface MedicationDto {
  id: number
  name: string
  kind: MedicationKind
  doseUnit: string
  doseUnitPlural: string
  defaultQuantity: number
  followUpMinutes: number | null
  effectiveFollowUpMinutes: number
  ingredients: MedicationIngredientDto[]
  isRemedy: boolean
  archived: boolean
  imageVersion: number | null
  doseCount: number
}

export interface MedicationImageData {
  contentType: string
  image: string
  thumbnail: string
}

export interface MedicationIngredientDto {
  ingredientId: number
  ingredientName: string
  measureUnit: string
  amountPerUnit: number | null
}

export interface MedicationIngredientInput {
  ingredientId: number
  amountPerUnit?: number | null
}

export interface MedicationInput {
  name: string
  kind?: MedicationKind
  doseUnit: string
  doseUnitPlural?: string
  defaultQuantity?: number
  followUpMinutes?: number | null
  ingredients?: MedicationIngredientInput[]
}

export type MedicationKind = 'acute' | 'preventive'

export interface Moment {
  at: number
  offset: number
}

export type Nausea = 'none' | 'nauseous' | 'vomited'

export type PainSide = 'left' | 'right' | 'both'

export interface PasswordChangeInput {
  currentPassword: string
  newPassword: string
}

export interface PastDoseInput {
  medicationId: number
  quantity?: number | null
  at: Moment
  rating?: Rating | null
}

export interface PendingRating {
  dose: DoseDto
  lastSeverity: number | null
}

export interface QuickDoseInput {
  medicationId: number
  quantity?: number | null
}

export interface RateInput {
  rating: Rating
  severity?: number | null
  at?: Moment | null
}

export type Rating = 'pain_free' | 'relieved' | 'no_effect' | 'unsure'

export interface RatingSuggestion {
  rating: Rating | null
  before: number | null
}

export interface ReadingDto {
  id: number
  at: Moment
  severity: number
  estimated: boolean
}

export interface ReadingInput {
  at?: Moment | null
  severity: number
}

export interface SettingsDto {
  locale: string | null
  timeZone: string | null
  theme: Theme
  dimDuringAttacks: boolean
  dayCutoff: string
  followUpMinutes: number
  usualMedicationId: number | null
  workdays: number[]
  workStart: string
  workEnd: string
  signWindowHours: number
  calendarFeed: boolean
}

export interface SettingsInput {
  timeZone?: string | null
  theme?: Theme
  dimDuringAttacks?: boolean
  dayCutoff?: string
  followUpMinutes?: number
  usualMedicationId?: number | null
  workdays?: number[]
  workStart?: string
  workEnd?: string
  signWindowHours?: number
}

export interface SetupInput {
  username: string
  password: string
  locale?: string | null
}

export interface SetupStatus {
  needsSetup: boolean
}

export interface StaleAttack {
  attackId: number
  start: Moment
  lastReading: ReadingDto | null
}

export interface StartAttackInput {
  at?: Moment | null
  severity?: number
  wokeUp?: boolean
  dose?: QuickDoseInput | null
}

export interface StartAttackResult {
  attack: AttackDto
  recurrenceOf: number | null
  episodeId: number
  dose: DoseDto | null
}

export interface SymptomDto {
  id: number
  name: string
  sortOrder: number
  archived: boolean
  signCount: number
}

export interface SymptomInput {
  name: string
}

export interface SymptomOrderInput {
  ids: number[]
}

export type Theme = 'dark' | 'light' | 'system'

export interface TimeZoneInput {
  timeZone: string
}

export interface TriggerDto {
  id: number
  name: string
  sortOrder: number
  archived: boolean
  attackCount: number
}

export interface TriggerInput {
  name: string
}

export interface TriggerOrderInput {
  ids: number[]
}

export interface UserDto {
  id: number
  username: string
  isAdmin: boolean
  isDisabled: boolean
  locale: string | null
  createdAt: number
}

export interface WarningSignDto {
  id: number
  at: Moment
  symptomIds: number[]
  note: string | null
  attackId: number | null
  attackStart: Moment | null
  createdAt: number
  updatedAt: number
}

export interface WarningSignInput {
  at?: Moment | null
  symptomIds?: number[]
  note?: string | null
}

export type WorkImpact = 'missed' | 'home_early' | 'none' | 'not_workday'

export interface WorkImpactDto {
  proposed: WorkImpact | null
  override: WorkImpact | null
  effective: WorkImpact | null
}

export interface WorkImpactInput {
  impact: WorkImpact | null
}
