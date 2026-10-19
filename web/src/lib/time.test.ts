import { describe, expect, it } from 'vitest'
import { clock, clockMinutes, dayOf, formatDuration, localDate } from './time'

const units = { d: 'd', h: 'h', min: 'min' }

describe('moments', () => {
  // 2026-10-19 00:30 in Oslo (UTC+2) = 2026-10-18 22:30 UTC.
  const lateNight = { at: Date.UTC(2026, 9, 18, 22, 30), offset: 120 }

  it('show the local time where they happened', () => {
    expect(clock(lateNight)).toBe('00:30')
    expect(localDate(lateNight)).toBe('2026-10-19')
  })

  it('belong to the day before until the cutoff (S-1)', () => {
    expect(dayOf(lateNight, 240)).toBe('2026-10-18')
    expect(dayOf(lateNight, 0)).toBe('2026-10-19')
  })

  it('parse clock times', () => {
    expect(clockMinutes('04:00')).toBe(240)
  })

  it('format durations', () => {
    expect(formatDuration(140 * 60_000, units)).toBe('2 h 20 min')
    expect(formatDuration(45 * 60_000, units)).toBe('45 min')
    expect(formatDuration(31 * 3600_000, units)).toBe('1 d 7 h')
  })
})
