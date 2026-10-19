import type { Moment } from '../api/types.gen'
import { currentLocale } from './format'

const pad = (n: number) => String(n).padStart(2, '0')
const MINUTE = 60_000

/** Now, with the browser's current UTC offset (TI-1). */
export function nowMoment(): Moment {
  const d = new Date()
  return { at: d.getTime(), offset: -d.getTimezoneOffset() }
}

/** A moment for a browser-local date and time ("YYYY-MM-DD", "HH:MM"). */
export function momentFromLocal(date: string, time: string): Moment {
  const d = new Date(`${date}T${time}`)
  return { at: d.getTime(), offset: -d.getTimezoneOffset() }
}

/** The local wall-clock time the moment happened, as a Date whose UTC fields hold it. */
function wall(m: Moment): Date {
  return new Date(m.at + m.offset * MINUTE)
}

/** HH:MM where it happened. */
export function clock(m: Moment): string {
  const d = wall(m)
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}

/** YYYY-MM-DD where it happened (calendar date, no cutoff). */
export function localDate(m: Moment): string {
  return wall(m).toISOString().slice(0, 10)
}

/** The day by cutoff (S-1): minutes after midnight belong to the day before. */
export function dayOf(m: Moment, cutoffMinutes: number): string {
  return new Date(m.at + (m.offset - cutoffMinutes) * MINUTE).toISOString().slice(0, 10)
}

/** "HH:MM" to minutes since midnight. */
export function clockMinutes(value: string): number {
  const [h, m] = value.split(':').map(Number)
  return h * 60 + m
}

/** The browser-local "YYYY-MM-DD" and "HH:MM" of a moment, for date and time inputs. */
export function toInputs(m: Moment): { date: string; time: string } {
  const d = new Date(m.at)
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` }
}

/** "2 h 20 min", "45 min", "3 d 4 h". */
export function formatDuration(millis: number, units: { d: string; h: string; min: string }): string {
  const minutes = Math.max(0, Math.round(millis / MINUTE))
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  const mins = minutes % 60
  if (days > 0) return hours > 0 ? `${days} ${units.d} ${hours} ${units.h}` : `${days} ${units.d}`
  if (hours > 0) return mins > 0 ? `${hours} ${units.h} ${mins} ${units.min}` : `${hours} ${units.h}`
  return `${mins} ${units.min}`
}

/** A time in ms as HH:MM in the browser's zone. */
export function clockOf(millis: number): string {
  const d = new Date(millis)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** "Mon 19 Oct" style for a moment. */
export function formatMomentDay(m: Moment): string {
  return new Intl.DateTimeFormat(currentLocale(), { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(wall(m))
}

/** The browser's IANA time zone. */
export function browserTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null
  } catch {
    return null
  }
}
