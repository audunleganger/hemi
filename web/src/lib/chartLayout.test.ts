import { describe, expect, it } from 'vitest'
import { BREAK_WIDTH, clusterTimes, labelRows, MIN_CLUSTER, ticks, timeAxis } from './chartLayout'

const H = 3_600_000
const T = Date.UTC(2026, 9, 19, 12, 0)

describe('the chart time axis', () => {
  it('keeps an episode and a short pain-free gap together', () => {
    expect(clusterTimes([{ from: T, to: T + 2 * H }, { from: T + 5 * H, to: T + 6 * H }])).toEqual([{ from: T, to: T + 6 * H }])
  })

  it('folds a long gap between episodes (AT-7)', () => {
    const axis = timeAxis([{ from: T, to: T + 4 * H }, { from: T + 30 * H, to: T + 34 * H }], 0, 400 + BREAK_WIDTH)
    expect(axis.clusters.map((c) => [c.x0, c.x1])).toEqual([[0, 200], [200 + BREAK_WIDTH, 400 + BREAK_WIDTH]])
    expect(axis.breaks).toEqual([{ x0: 200, x1: 200 + BREAK_WIDTH, millis: 26 * H }])
    expect(axis.x(T + 2 * H)).toBe(100)
    expect(axis.x(T + 32 * H)).toBe(300 + BREAK_WIDTH)
    // A time in the gap sits in the middle of the break.
    expect(axis.x(T + 10 * H)).toBe(200 + BREAK_WIDTH / 2)
  })

  it('gives a one-minute attack a width', () => {
    expect(clusterTimes([{ from: T, to: T + 60_000 }])).toEqual([{ from: T, to: T + MIN_CLUSTER }])
  })

  it('ends an ongoing attack now, however short (DS-3)', () => {
    expect(clusterTimes([{ from: T, to: T + 5 * 60_000 }], T + 5 * 60_000)).toEqual([{ from: T, to: T + 5 * 60_000 }])
    expect(clusterTimes([{ from: T, to: T }], T)).toEqual([{ from: T, to: T + 60_000 }])
  })

  it('takes points such as a dose before the start', () => {
    const [cluster] = clusterTimes([{ from: T, to: T + 3 * H }, { from: T - H, to: T - H }])
    expect(cluster.from).toBe(T - H)
  })

  it('ticks on round local hours, clear of the edges', () => {
    // 12:20–17:20 UTC, shown in UTC+2: 14:20–19:20 local, 100 px per hour.
    const cluster = { from: T + H / 3, to: T + 5 * H + H / 3, x0: 0, x1: 500 }
    const local = ticks(cluster, 120).map((time) => new Date(time + 2 * H).getUTCHours())
    // 19:00 is too close to the 19:20 edge label.
    expect(local).toEqual([15, 16, 17, 18])
  })
})

describe('dose labels', () => {
  it('move to the next row when they would overlap, and are left out when no row has room', () => {
    const labels = [
      { x: 0, width: 100 },
      { x: 50, width: 100 },
      { x: 60, width: 100 },
      { x: 120, width: 40 },
    ]
    expect(labelRows(labels, 2)).toEqual([0, 1, null, 0])
  })
})
