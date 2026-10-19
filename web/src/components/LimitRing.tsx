import { useTranslation } from 'react-i18next'
import type { AcuteMedicationDays, LimitStatusDto } from '../api/types.gen'
import { formatNumber } from '../lib/format'
import { limitLabel, limitUsage } from '../lib/limits'

function Ring({ fraction, tone }: { fraction: number; tone: 'ok' | 'near' | 'over' }) {
  const r = 15
  const c = 2 * Math.PI * r
  return (
    <svg width="38" height="38" viewBox="0 0 38 38" aria-hidden="true" className={`ring ring-${tone}`}>
      <circle cx="19" cy="19" r={r} fill="none" className="ring-track" strokeWidth="5" />
      {fraction > 0 && (
        <circle cx="19" cy="19" r={r} fill="none" className="ring-value" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${c * Math.min(1, fraction)} ${c}`} transform="rotate(-90 19 19)" />
      )}
    </svg>
  )
}

export function toneOf(state: LimitStatusDto['state']): 'ok' | 'near' | 'over' {
  return state === 'ok' ? 'ok' : state === 'near' ? 'near' : 'over'
}

/** A limit as a small donut with "4 / 6" and a short label (DS-8). */
export function LimitRing({ status }: { status: LimitStatusDto }) {
  const { t } = useTranslation()
  const fraction = status.limit.kind === 'min_interval' ? (status.nextAllowedAt ? 1 : 0) : status.used / status.max
  return (
    <div className="limit-ring" title={limitLabel(status, t)}>
      <Ring fraction={fraction} tone={toneOf(status.state)} />
      <span>
        <b className="tnum">{limitUsage(status, t)}</b>
        <small>{limitLabel(status, t)}</small>
      </span>
    </div>
  )
}

/** Acute medication days in the last 30 days (ST-7), as a ring next to the limits. */
export function AcuteDaysRing({ days }: { days: AcuteMedicationDays }) {
  const { t } = useTranslation()
  return (
    <div className="limit-ring">
      <Ring fraction={days.count / days.windowDays} tone="ok" />
      <span>
        <b className="tnum">
          {formatNumber(days.count)} / {days.windowDays}
        </b>
        <small>{t('limits.acuteDays')}</small>
      </span>
    </div>
  )
}
