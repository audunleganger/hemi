import { useTranslation } from 'react-i18next'
import type { HomeView } from '../../api/types.gen'
import { clock, formatMomentDay } from '../../lib/time'
import { useRecord } from '../../record/RecordContext'

/** Pending ratings (DO-6) and the question about a stale attack (AT-6), shown each time the app opens. */
export function Notices({ home, ratings = true }: { home: HomeView; ratings?: boolean }) {
  const { t } = useTranslation()
  const record = useRecord()
  const stale = home.staleAttack
  if (!stale && (!ratings || home.pendingRatings.length === 0)) return null
  return (
    <div className="notices">
      {stale && (
        <div className="notice">
          <span>
            {t('stale.question', { day: formatMomentDay(stale.start) })}
            {stale.lastReading && <small>{t('stale.last', { severity: stale.lastReading.severity, time: clock(stale.lastReading.at) })}</small>}
          </span>
          <button type="button" className="btn btn-small" onClick={() => record.open({ kind: 'end', attackId: stale.attackId, lastReading: stale.lastReading?.at })}>
            {t('stale.answer')}
          </button>
        </div>
      )}
      {ratings &&
        home.pendingRatings.map((pending) => (
          <div key={pending.dose.id} className="notice">
            <span>{t('rating.question', { medication: pending.dose.medicationName, time: clock(pending.dose.at) })}</span>
            <button type="button" className="btn btn-small btn-primary" onClick={() => record.open({ kind: 'rating', pending })}>
              {t('rating.rate')}
            </button>
          </div>
        ))}
    </div>
  )
}
