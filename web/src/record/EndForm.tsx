import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as endpoints from '../api/endpoints'
import { useApiMutation } from '../api/queries'
import type { Moment } from '../api/types.gen'
import { ErrorText, Field } from '../components/ui'
import { clock, momentFromLocal, nowMoment, toInputs } from '../lib/time'

/**
 * "It's over" (AT-6): now, at a chosen time (the main button follows the picker), gone when the user woke up
 * (the time they fell asleep, saved as an estimate), or (for a stale attack) at the last reading.
 */
export function EndForm({ attackId, lastReading, onDone }: { attackId: number; lastReading?: Moment; onDone: () => void }) {
  const { t } = useTranslation()
  const [initial] = useState(() => toInputs(nowMoment()))
  const [date, setDate] = useState(initial.date)
  const [time, setTime] = useState(initial.time)
  const [asleep, setAsleep] = useState(false)
  // One button that follows the picker, so a changed time can't be ignored by tapping "now".
  const picked = asleep || date !== initial.date || time !== initial.time
  const end = useApiMutation((input: { at?: Moment; asleep?: boolean }) => endpoints.endAttack(attackId, input))
  return (
    <div className="stack">
      <label className="checkbox">
        <input type="checkbox" checked={asleep} onChange={(e) => setAsleep(e.target.checked)} /> {t('end.asleep')}
      </label>
      <div className="form-row">
        <Field label={t('dose.date')}>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label={asleep ? t('end.asleepAt') : t('dose.time')}>
          <input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
      </div>
      {asleep && <p className="field-hint">{t('end.asleepHint')}</p>}
      <button
        type="button"
        className="btn btn-primary btn-block"
        disabled={end.isPending || (picked && (!date || !time))}
        onClick={() => end.mutate(picked ? { at: momentFromLocal(date, time), asleep } : {}, { onSuccess: onDone })}
      >
        {picked ? t('end.atTime', { time }) : t('end.now')}
      </button>
      {lastReading && (
        <button type="button" className="btn btn-block" disabled={end.isPending} onClick={() => end.mutate({ at: lastReading }, { onSuccess: onDone })}>
          {t('end.atLastReading', { time: clock(lastReading) })}
        </button>
      )}
      <ErrorText error={end.error} />
    </div>
  )
}
