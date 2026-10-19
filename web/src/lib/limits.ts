import type { TFunction } from 'i18next'
import type { LimitKind, LimitStatusDto } from '../api/types.gen'
import { formatNumber } from './format'
import { clockOf } from './time'

const DAY = 24 * 60

/** A window as "24 h", "30 days", "1 week" (LI-2). */
export function formatWindow(minutes: number, t: TFunction): string {
  if (minutes % (7 * DAY) === 0 && minutes !== 30 * DAY) return t('limits.weeks', { count: minutes / (7 * DAY) })
  if (minutes % DAY === 0 && minutes > DAY) return t('limits.days', { count: minutes / DAY })
  if (minutes % 60 === 0) return t('limits.hours', { count: minutes / 60 })
  return t('limits.minutes', { count: minutes })
}

/** "Sumatriptan days", "Paracetamol mg", … for rings (DS-8). */
export function limitLabel(status: LimitStatusDto, t: TFunction): string {
  return t(`limits.short.${status.limit.kind}` as `limits.short.${LimitKind}`, { ingredient: status.ingredientName, unit: status.measureUnit })
}

/** "4 / 6", "2500 / 4000", or for intervals "OK" / "from 16:40". */
export function limitUsage(status: LimitStatusDto, t: TFunction): string {
  if (status.limit.kind === 'min_interval') return status.nextAllowedAt ? t('limits.from', { time: clockOf(status.nextAllowedAt) }) : t('limits.okNow')
  return `${formatNumber(status.used)} / ${formatNumber(status.max)}`
}

/** A full sentence for lists: "Sumatriptan: 4 of 6 days in 30 days". */
export function limitSentence(status: LimitStatusDto, t: TFunction): string {
  const window = formatWindow(status.limit.windowMinutes, t)
  const values = { ingredient: status.ingredientName, used: formatNumber(status.used), max: formatNumber(status.max), unit: status.measureUnit, window }
  if (status.limit.kind === 'min_interval') {
    return status.nextAllowedAt
      ? t('limits.sentence.waiting', { ...values, time: clockOf(status.nextAllowedAt) })
      : t('limits.sentence.intervalOk', values)
  }
  return t(`limits.sentence.${status.limit.kind}` as 'limits.sentence.days', values)
}
