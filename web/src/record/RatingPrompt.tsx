import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as endpoints from '../api/endpoints'
import { useApiMutation } from '../api/queries'
import type { PendingRating, Rating } from '../api/types.gen'
import { SeverityButtons } from '../components/SeverityButtons'
import { ErrorText } from '../components/ui'
import { clock } from '../lib/time'

export const RATINGS: Rating[] = ['pain_free', 'relieved', 'no_effect', 'unsure']

/**
 * "Imigran, 2 h ago: how is it now?" (DO-5, DO-6): the current severity (stored as a reading), then the
 * rating, prefilled from the readings. Or dismiss it.
 */
export function RatingPrompt({ pending, onDone }: { pending: PendingRating; onDone?: () => void }) {
  const { t } = useTranslation()
  const [severity, setSeverity] = useState<number | null>(pending.lastSeverity)
  const [chosen, setChosen] = useState<Rating | null>(null)
  const suggestion = useQuery({
    queryKey: ['suggestion', pending.dose.id, severity],
    queryFn: () => endpoints.ratingSuggestion(pending.dose.id, severity!),
    enabled: severity !== null,
  })
  const rating = chosen ?? suggestion.data?.rating ?? null
  const rate = useApiMutation(() => endpoints.rateDose(pending.dose.id, { rating: rating!, severity }))
  const dismiss = useApiMutation(() => endpoints.dismissRating(pending.dose.id))

  return (
    <div className="rating-prompt stack">
      <p className="rating-question">
        {t('rating.question', { medication: pending.dose.medicationName, time: clock(pending.dose.at) })}
      </p>
      <SeverityButtons value={severity} onChange={(s) => {
        setSeverity(s)
        setChosen(null)
      }} label={t('dose.severityNow')} />
      <div className="segmented rating-options" role="group" aria-label={t('rating.label')}>
        {RATINGS.map((r) => (
          <button key={r} type="button" className={rating === r ? 'active' : ''} aria-pressed={rating === r} onClick={() => setChosen(r)}>
            {t(`rating.${r}`)}
            {r === suggestion.data?.rating && chosen === null ? ' ✓' : ''}
          </button>
        ))}
      </div>
      <ErrorText error={rate.error ?? dismiss.error} />
      <div className="row-actions">
        <button type="button" className="btn btn-primary" disabled={rating === null || rate.isPending} onClick={() => rate.mutate(undefined, { onSuccess: onDone })}>
          {t('rating.save')}
        </button>
        <button type="button" className="btn btn-ghost" disabled={dismiss.isPending} onClick={() => dismiss.mutate(undefined, { onSuccess: onDone })}>
          {t('rating.dismiss')}
        </button>
      </div>
    </div>
  )
}

/** DS-3: the pending rating in attack mode, with the suggestion for the current severity as one tap. */
export function QuickRating({ pending, severity, onOpen }: { pending: PendingRating; severity: number | null; onOpen: () => void }) {
  const { t } = useTranslation()
  const suggestion = useQuery({
    queryKey: ['suggestion', pending.dose.id, severity],
    queryFn: () => endpoints.ratingSuggestion(pending.dose.id, severity!),
    enabled: severity !== null,
  })
  const rate = useApiMutation((r: Rating) => endpoints.rateDose(pending.dose.id, { rating: r, severity }))
  const suggested = suggestion.data?.rating ?? null
  return (
    <div className="quick-rating">
      <button type="button" className="quick-rating-text" onClick={onOpen}>
        {t('rating.short', { medication: pending.dose.medicationName, time: clock(pending.dose.at) })}
        <b>{t('rating.howDidItGo')}</b>
      </button>
      {suggested ? (
        <button type="button" className="pill-button" disabled={rate.isPending} onClick={() => rate.mutate(suggested)}>
          {t(`rating.${suggested}`)} ✓
        </button>
      ) : (
        <button type="button" className="pill-button" onClick={onOpen}>
          {t('rating.rate')}
        </button>
      )}
    </div>
  )
}
