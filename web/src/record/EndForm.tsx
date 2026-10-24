import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as endpoints from '../api/endpoints'
import { useApiMutation } from '../api/queries'
import type { Moment } from '../api/types.gen'
import { ErrorText, Field } from '../components/ui'
import { clock, momentFromLocal, nowMoment, toInputs } from '../lib/time'

/** "It's over" (AT-6): now, at a chosen time (the main button follows the picker), or (for a stale attack) at the last reading. */
export function EndForm({ attackId, lastReading, onDone }: { attackId: number; lastReading?: Moment; onDone: () => void }) {
  const { t } = useTranslation()
  const [initial] = useState(() => toInputs(nowMoment()))
  const [date, setDate] = useState(initial.date)
  const [time, setTime] = useState(initial.time)
  // One button that follows the picker, so a changed time can't be ignored by tapping "now".
  const picked = date !== initial.date || time !== initial.time
  const end = useApiMutation((at: Moment | undefined) => endpoints.endAttack(attackId, { at }))
  return (
    <div className="stack">
      <div className="form-row">
        <Field label={t('dose.date')}>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label={t('dose.time')}>
          <input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
      </div>
      <button
        type="button"
        className="btn btn-primary btn-block"
        disabled={end.isPending || (picked && (!date || !time))}
        onClick={() => end.mutate(picked ? momentFromLocal(date, time) : undefined, { onSuccess: onDone })}
      >
        {picked ? t('end.atTime', { time }) : t('end.now')}
      </button>
      {lastReading && (
        <button type="button" className="btn btn-block" disabled={end.isPending} onClick={() => end.mutate(lastReading, { onSuccess: onDone })}>
          {t('end.atLastReading', { time: clock(lastReading) })}
        </button>
      )}
      <ErrorText error={end.error} />
    </div>
  )
}
