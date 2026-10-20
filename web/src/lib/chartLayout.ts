/**
 * The attack chart's time axis (DS-10). Times that belong together form a cluster that gets its own stretch of
 * the axis; a long pain-free gap between clusters (a recurrence, AT-7) is folded into a short break, so an
 * attack with episodes a day apart doesn't squeeze each episode into a sliver.
 */

const MINUTE = 60_000
const HOUR = 60 * MINUTE

export interface Interval {
  from: number
  to: number
}

export interface Cluster extends Interval {
  /** Left edge in px. */
  x0: number
  /** Right edge in px. */
  x1: number
}

export interface TimeAxis {
  clusters: Cluster[]
  /** The gaps between clusters, in px, with how long they were. */
  breaks: { x0: number; x1: number; millis: number }[]
  /** Maps a time to px. Times in a break go to its middle. */
  x(time: number): number
}

/** A gap shorter than this stays on the axis as it is. */
export const FOLD_GAP = 6 * HOUR
/** The shortest stretch a cluster is drawn as, so an attack logged in one minute still has a width. */
export const MIN_CLUSTER = HOUR
/** The width of a folded gap, in px. */
export const BREAK_WIDTH = 36

/**
 * Merges the intervals (episodes, and readings and doses as points) into clusters with gaps under [FOLD_GAP].
 * With [openEnd] (an ongoing attack's now) the last cluster ends exactly there instead of being widened.
 */
export function clusterTimes(intervals: Interval[], openEnd?: number): Interval[] {
  const sorted = intervals.map((i) => ({ from: i.from, to: Math.max(i.from, i.to) })).sort((a, b) => a.from - b.from)
  const merged: Interval[] = []
  for (const interval of sorted) {
    const last = merged.at(-1)
    if (last && interval.from - last.to < FOLD_GAP) last.to = Math.max(last.to, interval.to)
    else merged.push({ ...interval })
  }
  // Clusters are at least FOLD_GAP apart, more than MIN_CLUSTER, so widening never reaches the next one.
  merged.forEach((cluster, i) => {
    const open = openEnd !== undefined && i === merged.length - 1
    if (open) cluster.to = Math.max(cluster.to, openEnd, cluster.from + MINUTE)
    else if (cluster.to - cluster.from < MIN_CLUSTER) cluster.to = cluster.from + MIN_CLUSTER
  })
  return merged
}

/** Lays the clusters out between [left] and [right] px, each as wide as its share of the time drawn. */
export function timeAxis(intervals: Interval[], left: number, right: number, openEnd?: number): TimeAxis {
  const merged = clusterTimes(intervals, openEnd)
  const breakCount = Math.max(0, merged.length - 1)
  const total = merged.reduce((sum, c) => sum + (c.to - c.from), 0)
  const room = Math.max(1, right - left - breakCount * BREAK_WIDTH)
  const clusters: Cluster[] = []
  let cursor = left
  for (const c of merged) {
    const width = ((c.to - c.from) / total) * room
    clusters.push({ ...c, x0: cursor, x1: cursor + width })
    cursor += width + BREAK_WIDTH
  }
  const breaks = clusters.slice(1).map((c, i) => ({ x0: clusters[i].x1, x1: c.x0, millis: c.from - clusters[i].to }))
  const x = (time: number) => {
    for (let i = 0; i < clusters.length; i++) {
      const c = clusters[i]
      if (time <= c.to || i === clusters.length - 1) {
        if (time < c.from) return i === 0 ? c.x0 : (clusters[i - 1].x1 + c.x0) / 2
        return c.x0 + ((Math.min(time, c.to) - c.from) / (c.to - c.from)) * (c.x1 - c.x0)
      }
    }
    return right
  }
  return { clusters, breaks, x }
}

const STEPS = [15, 30, 60, 120, 180, 360, 720, 1440].map((m) => m * MINUTE)

/**
 * Tick times for a cluster at least [minSpacing] px apart, on round local times (offset in minutes, as in
 * a Moment). The cluster's edges have their own labels, so ticks keep [clearLeft] and [clearRight] px from them.
 */
export function ticks(cluster: Cluster, offsetMinutes: number, minSpacing = 56, clearLeft = minSpacing * 0.75, clearRight = clearLeft): number[] {
  const pxPerMs = (cluster.x1 - cluster.x0) / (cluster.to - cluster.from)
  const step = STEPS.find((s) => s * pxPerMs >= minSpacing)
  if (!step) return []
  const shift = offsetMinutes * MINUTE
  const first = Math.ceil((cluster.from + shift) / step) * step - shift
  const result: number[] = []
  for (let time = first; time <= cluster.to; time += step) {
    // Ticks are centred, so half a tick label more.
    if ((time - cluster.from) * pxPerMs >= clearLeft + 18 && (cluster.to - time) * pxPerMs >= clearRight + 18) result.push(time)
  }
  return result
}

/**
 * Puts each label on the first row where it doesn't overlap the one before it; null when no row has room.
 * Labels are given as their left x and width, in drawing order.
 */
export function labelRows(labels: { x: number; width: number }[], rows: number, gap = 6): (number | null)[] {
  const ends = new Array<number>(rows).fill(-Infinity)
  return labels.map((label) => {
    const row = ends.findIndex((end) => label.x >= end + gap)
    if (row < 0) return null
    ends[row] = label.x + label.width
    return row
  })
}
