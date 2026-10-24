import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import type { DayView, DoseDto, PendingRating, WorkImpact } from '../api/types.gen'
import * as endpoints from '../api/endpoints'
import { useApiMutation, useSymptoms } from '../api/queries'
import { formatQuantity } from '../lib/format'
import { clock, clockOf, dayOf } from '../lib/time'
import { useRecord } from '../record/RecordContext'
import { severityColor } from './HeadIcon'
import { symptomNames } from '../lib/symptoms'

const IMPACTS: WorkImpact[] = ['missed', 'home_early', 'none', 'not_workday']

interface Item {
  at: number
  key: string
  time: string
  marker: 'reading' | 'dose' | 'due' | 'event' | 'sign'
  severity?: number
  content: React.ReactNode
}

/**
 * The selected day as a vertical timeline (DS-2): readings, doses, warning signs, due ratings, and the day's work
 * impact (WI-1 … WI-3). An attack's start links to its page (V-5); a warning sign opens for editing (WS-5).
 */
export function DayTimeline({ day, cutoffMinutes, now, pending }: { day: DayView; cutoffMinutes: number; now: number; pending: PendingRating[] }) {
  const { t } = useTranslation()
  const record = useRecord()
  const setImpact = useApiMutation((impact: WorkImpact | null) => endpoints.setWorkImpact(day.date, impact))
  const symptoms = useSymptoms(true)
  const items: Item[] = []

  for (const sign of day.signs) {
    const names = symptomNames(sign.symptomIds, symptoms.data)
    const details = [names.join(', '), sign.note].filter(Boolean).join(' · ')
    items.push({
      at: sign.at.at,
      key: `s-${sign.id}`,
      time: clock(sign.at),
      marker: 'sign',
      content: (
        <span>
          <button type="button" className="link-button" onClick={() => record.open({ kind: 'sign', sign })}>
            {t('day.sign')}
          </button>
          {details && <small>{details}</small>}
        </span>
      ),
    })
  }

  for (const attack of day.attacks) {
    if (dayOf(attack.start, cutoffMinutes) === day.date) {
      const note = [attack.wokeUp ? t('day.wokeUp') : null, attack.status !== 'migraine' ? t(`status.${attack.status}`) : null].filter(Boolean).join(' · ')
      items.push({ at: attack.start.at - 1, key: `start-${attack.id}`, time: clock(attack.start), marker: 'event', content: <span><Link to={`/attacks/${attack.id}`}>{t('day.started')}</Link>{note && <small>{note}</small>}</span> })
    }
    if (attack.end && dayOf(attack.end, cutoffMinutes) === day.date) {
      items.push({ at: attack.end.at + 1, key: `end-${attack.id}`, time: clock(attack.end), marker: 'event', content: <span>{t('day.over')}{attack.endedAsleep && <small>{t('day.endedAsleep')}</small>}</span> })
    }
  }
  for (const { attackId, reading } of day.readings) {
    items.push({
      at: reading.at.at,
      key: `r-${reading.id}-${attackId}`,
      time: clock(reading.at),
      marker: 'reading',
      severity: reading.severity,
      content: (
        <span>
          {t('day.reading', { name: t(`severity.s${reading.severity}` as 'severity.s0'), severity: reading.severity })}
          {reading.estimated && <small>{t('day.estimated')}</small>}
        </span>
      ),
    })
  }
  const doseText = (dose: DoseDto) => `${dose.medicationName} · ${formatQuantity(dose.quantity)} ${dose.doseUnit}`
  for (const dose of day.doses) {
    const rating = dose.rating ? t(`rating.${dose.rating}`) + (dose.sustained === false ? ` · ${t('rating.notSustained')}` : '') : null
    items.push({
      at: dose.at.at,
      key: `d-${dose.id}`,
      time: clock(dose.at),
      marker: 'dose',
      content: (
        <span>
          {doseText(dose)}
          {dose.overLimit && <span className="badge badge-warning">{t('dose.overLimit')}</span>}
          {(rating || !dose.attackId) && <small>{rating ?? t('dose.noAttack')}</small>}
        </span>
      ),
    })
    if (dose.dueAt !== null) {
      const pend = pending.find((p) => p.dose.id === dose.id)
      items.push({
        at: dose.dueAt,
        key: `due-${dose.id}`,
        time: clockOf(dose.dueAt),
        marker: 'due',
        content:
          dose.dueAt <= now && pend ? (
            <button type="button" className="link-button" onClick={() => record.open({ kind: 'rating', pending: pend })}>
              {t('day.rateNow', { medication: dose.medicationName })}
            </button>
          ) : (
            <span className="muted">{t('day.rateLater', { medication: dose.medicationName })}</span>
          ),
      })
    }
  }
  items.sort((a, b) => a.at - b.at)

  return (
    <div className="timeline">
      {items.length === 0 && <p className="empty">{t('day.empty')}</p>}
      {items.map((item) => (
        <div key={item.key} className="tl-item">
          <span className="tl-time tnum">{item.time}</span>
          <span className={`tl-marker ${item.marker}`} style={item.marker === 'reading' ? { background: item.severity ? severityColor(item.severity) : 'var(--surface)' } : undefined} />
          <span className="tl-content">{item.content}</span>
        </div>
      ))}
      {day.workImpact && (
        <div className="tl-item work">
          <span className="tl-time">{t('day.work')}</span>
          <span className="tl-marker" />
          <span className="tl-content">
            <select
              className="input input-inline"
              aria-label={t('day.workImpact')}
              value={day.workImpact.override ?? ''}
              onChange={(e) => setImpact.mutate((e.target.value || null) as WorkImpact | null)}
            >
              <option value="">
                {day.workImpact.proposed ? t('day.proposed', { impact: t(`impact.${day.workImpact.proposed}`) }) : t('day.noProposal')}
              </option>
              {IMPACTS.map((impact) => (
                <option key={impact} value={impact}>
                  {t(`impact.${impact}`)}
                </option>
              ))}
            </select>
          </span>
        </div>
      )}
    </div>
  )
}
