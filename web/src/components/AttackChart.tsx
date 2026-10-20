import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AttackDto } from '../api/types.gen'
import { labelRows, ticks, timeAxis, type Interval } from '../lib/chartLayout'
import { clock, formatMomentDay, localDate } from '../lib/time'
import { severityColor } from './HeadIcon'

/** The step curve's changes: each reading, and 0 at each episode's end. */
export function steps(attack: AttackDto): { at: number; severity: number }[] {
  const points = attack.readings.map((r) => ({ at: r.at.at, severity: r.severity }))
  for (const episode of attack.episodes) if (episode.end) points.push({ at: episode.end.at, severity: 0 })
  return points.sort((a, b) => a.at - b.at)
}

const HOUR = 3_600_000
const LABEL_ROWS = 2
const ROW = 14
/** About how wide a character of the 11 px label font is. */
const CHAR = 6.2

/** The chart's own width in px, so text stays 11 px on a phone instead of being scaled down. */
function useWidth(fallback: number) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(fallback)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(240, Math.round(entry.contentRect.width))))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return [ref, width] as const
}

/**
 * DS-10: readings as a filled step curve on a 0–3 axis, doses as markers with the medication's name and
 * rating, due ratings as hollow dots, recurrences as gaps between episodes. A long pain-free gap is folded
 * into a short break with its length, so each episode keeps a readable width.
 */
export function AttackChart({ attack, now, height = 200 }: { attack: AttackDto; now: number; height?: number }) {
  const { t } = useTranslation()
  const [ref, W] = useWidth(640)
  const H = height
  const padL = 22
  const padR = 12
  const padT = 10 + LABEL_ROWS * ROW
  const padB = 22
  const offset = attack.summary.start.offset
  const at = (time: number) => ({ at: time, offset })
  const units = { d: t('units.d'), h: t('units.h') }

  const episodes = attack.episodes.map((e, i) => {
    const last = i === attack.episodes.length - 1
    return { from: e.start.at, to: e.end?.at ?? (last && attack.summary.ongoing ? now : e.start.at) }
  })
  const points = [...attack.readings.map((r) => r.at.at), ...attack.doses.map((d) => d.at.at)]
  const latest = Math.max(...episodes.map((e) => e.to), ...points)
  const ongoing = attack.summary.ongoing
  const due = attack.doses.filter((d) => d.dueAt !== null && d.dueAt <= latest + 6 * HOUR)
  // While ongoing the axis ends now; a rating due later sits at its right edge.
  const duePoints = due.map((d) => d.dueAt!).filter((time) => !ongoing || time <= now)
  const intervals: Interval[] = [...episodes, ...[...points, ...duePoints].map((p) => ({ from: p, to: p }))]
  const axis = timeAxis(intervals, padL, W - padR, ongoing ? now : undefined)
  const { x } = axis
  const y = (severity: number) => H - padB - (severity / 3) * (H - padT - padB)
  const end = axis.clusters.at(-1)!.to

  // Each step, cut to the clusters it crosses: nothing is drawn in a folded gap.
  const changes = steps(attack)
  const segments = changes.flatMap((p, i) => {
    const to = changes[i + 1]?.at ?? end
    return axis.clusters
      .filter((c) => c.to > p.at && c.from < to)
      .map((c) => ({ cluster: axis.clusters.indexOf(c), from: Math.max(p.at, c.from), to: Math.min(to, c.to), severity: p.severity }))
  })
  const paths = axis.clusters.map((_, i) =>
    segments
      .filter((s) => s.cluster === i)
      .map((s, j) => `${j === 0 ? 'M' : 'L'}${x(s.from)} ${y(s.severity)} H${x(s.to)}`)
      .join(' '),
  )

  const doseLabels = attack.doses.map((d) => {
    const text = d.rating ? `${d.medicationName} · ${t(`rating.${d.rating}`)}` : d.medicationName
    return { dose: d, text, x: x(d.at.at) + 6, width: text.length * CHAR }
  })
  const rows = labelRows(doseLabels, LABEL_ROWS)

  const description = t('chart.label', {
    start: clock(attack.summary.start),
    readings: attack.readings.map((r) => `${r.severity} ${clock(r.at)}`).join(', '),
  })
  const startDate = localDate(attack.summary.start)
  const edgeLabel = (time: number) => (localDate(at(time)) === startDate ? clock(at(time)) : `${formatMomentDay(at(time))} ${clock(at(time))}`)
  const gapLabel = (millis: number) => (millis < 48 * HOUR ? `${Math.round(millis / HOUR)} ${units.h}` : `${Math.round(millis / (24 * HOUR))} ${units.d}`)

  return (
    <div ref={ref} className="attack-chart-wrap">
      <svg className="attack-chart" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={description}>
        {axis.clusters.map((c, i) => (
          <g key={`grid-${i}`}>
            {[1, 2, 3].map((s) => (
              <line key={s} x1={c.x0} x2={c.x1} y1={y(s)} y2={y(s)} className="chart-grid" />
            ))}
            <line x1={c.x0} x2={c.x1} y1={y(0)} y2={y(0)} className="chart-axis" />
          </g>
        ))}
        {[1, 2, 3].map((s) => (
          <text key={s} x={padL - 6} y={y(s) + 4} textAnchor="end" className="chart-label">
            {s}
          </text>
        ))}
        {axis.breaks.map((b, i) => (
          <g key={`break-${i}`} className="chart-break">
            <line x1={b.x0 + 4} x2={b.x1 - 4} y1={y(0)} y2={y(0)} className="chart-gap" />
            <text x={(b.x0 + b.x1) / 2} y={y(0) - 8} textAnchor="middle" className="chart-label">
              {gapLabel(b.millis)}
            </text>
          </g>
        ))}
        {segments.map((s, i) =>
          s.severity > 0 ? <rect key={i} x={x(s.from)} y={y(s.severity)} width={Math.max(0, x(s.to) - x(s.from))} height={y(0) - y(s.severity)} fill={severityColor(s.severity)} opacity={0.85} /> : null,
        )}
        {paths.map((d, i) => (d ? <path key={i} d={d} className="chart-line" /> : null))}
        {doseLabels.map(({ dose, text }, i) => {
          const dx = x(dose.at.at)
          const row = rows[i]
          return (
            <g key={dose.id}>
              <title>{`${clock(dose.at)} ${text}`}</title>
              <line x1={dx} x2={dx} y1={padT - 6} y2={y(0)} className="chart-dose" />
              <rect x={dx - 4} y={padT - 10} width={8} height={8} rx={2} className="chart-dose-mark" />
              {row !== null && (
                <text x={dx + 6} y={10 + row * ROW} className="chart-label">
                  {text}
                </text>
              )}
            </g>
          )
        })}
        {due.map((d) => {
          const dx = Math.min(x(Math.min(d.dueAt!, end)), W - padR - 5)
          return (
            <g key={`due-${d.id}`}>
              <circle cx={dx} cy={y(0)} r={4.5} className="chart-due" />
              <text x={dx} y={y(0) - 8} textAnchor="middle" className="chart-label">
                {t('chart.rate')}
              </text>
            </g>
          )
        })}
        {axis.clusters.map((c, i) => {
          const last = i === axis.clusters.length - 1
          const startText = edgeLabel(c.from)
          const endText = last && ongoing ? t('chart.now') : clock(at(c.to))
          // A narrow cluster shows only its start.
          const wide = c.x1 - c.x0 >= (startText.length + endText.length) * CHAR + 12
          return (
            <g key={`ticks-${i}`}>
              {ticks(c, offset, 56, startText.length * CHAR + 10, wide ? endText.length * CHAR + 10 : 0).map((time) => (
                <text key={time} x={x(time)} y={H - 5} textAnchor="middle" className="chart-label chart-tick">
                  {clock(at(time))}
                </text>
              ))}
              <text x={c.x0} y={H - 5} className="chart-label">
                {startText}
              </text>
              {wide && (
                <text x={c.x1} y={H - 5} textAnchor="end" className="chart-label">
                  {endText}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
