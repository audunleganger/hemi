import { useTranslation } from 'react-i18next'
import type { AttackDto } from '../api/types.gen'
import { clock, clockOf } from '../lib/time'
import { severityColor } from './HeadIcon'

/** The step curve's changes: each reading, and 0 at each episode's end. */
export function steps(attack: AttackDto): { at: number; severity: number }[] {
  const points = attack.readings.map((r) => ({ at: r.at.at, severity: r.severity }))
  for (const episode of attack.episodes) if (episode.end) points.push({ at: episode.end.at, severity: 0 })
  return points.sort((a, b) => a.at - b.at)
}

/**
 * DS-10: readings as a filled step curve on a 0–3 axis, doses as markers with the medication's name, due
 * ratings as hollow dots, recurrences as gaps between episodes.
 */
export function AttackChart({ attack, now, height = 200 }: { attack: AttackDto; now: number; height?: number }) {
  const { t } = useTranslation()
  const W = 720
  const H = height
  const padL = 22
  const padR = 12
  const padT = 26
  const padB = 22
  const start = attack.summary.start.at
  const end = attack.summary.ongoing ? now : (attack.summary.end?.at ?? Math.max(start + 3600_000, ...attack.readings.map((r) => r.at.at)))
  const span = Math.max(end - start, 60_000)
  const x = (time: number) => padL + ((time - start) / span) * (W - padL - padR)
  const y = (severity: number) => H - padB - (severity / 3) * (H - padT - padB)
  const points = steps(attack)

  const segments = points.map((p, i) => ({ from: p.at, to: points[i + 1]?.at ?? end, severity: p.severity }))
  const path = segments.map((s, i) => `${i === 0 ? 'M' : 'L'}${x(s.from)} ${y(s.severity)} H${x(s.to)}`).join(' ')
  const due = attack.doses.filter((d) => d.dueAt !== null && d.dueAt >= start && d.dueAt <= end + 6 * 3600_000)
  const description = t('chart.label', {
    start: clock(attack.summary.start),
    readings: attack.readings.map((r) => `${r.severity} ${clock(r.at)}`).join(', '),
  })

  return (
    <svg className="attack-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={description}>
      {[1, 2, 3].map((s) => (
        <g key={s}>
          <line x1={padL} x2={W - padR} y1={y(s)} y2={y(s)} className="chart-grid" />
          <text x={padL - 6} y={y(s) + 4} textAnchor="end" className="chart-label">
            {s}
          </text>
        </g>
      ))}
      {segments.map((s, i) =>
        s.severity > 0 ? <rect key={i} x={x(s.from)} y={y(s.severity)} width={Math.max(0, x(s.to) - x(s.from))} height={y(0) - y(s.severity)} fill={severityColor(s.severity)} opacity={0.85} /> : null,
      )}
      <line x1={padL} x2={W - padR} y1={y(0)} y2={y(0)} className="chart-axis" />
      {path && <path d={path} className="chart-line" />}
      {attack.doses.map((d) => (
        <g key={d.id}>
          <line x1={x(d.at.at)} x2={x(d.at.at)} y1={padT - 8} y2={y(0)} className="chart-dose" />
          <rect x={x(d.at.at) - 4} y={padT - 14} width={8} height={8} rx={2} className="chart-dose-mark" />
          <text x={x(d.at.at) + 8} y={padT - 6} className="chart-label">
            {d.medicationName}
          </text>
        </g>
      ))}
      {due.map((d) => (
        <g key={`due-${d.id}`}>
          <circle cx={Math.min(x(d.dueAt!), W - padR - 5)} cy={y(0)} r={4.5} className="chart-due" />
          <text x={Math.min(x(d.dueAt!), W - padR - 5)} y={y(0) - 8} textAnchor="middle" className="chart-label">
            {t('chart.rate')}
          </text>
        </g>
      ))}
      <text x={padL} y={H - 5} className="chart-label">
        {clock(attack.summary.start)}
      </text>
      <text x={W - padR} y={H - 5} textAnchor="end" className="chart-label">
        {attack.summary.ongoing ? t('chart.now') : clockOf(end)}
      </text>
    </svg>
  )
}
