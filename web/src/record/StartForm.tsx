import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { SeverityButtons } from '../components/SeverityButtons'
import { ErrorText, Field, FieldGroup } from '../components/ui'
import { momentFromLocal, nowMoment, toInputs } from '../lib/time'
import { useStartAttack } from './useStartAttack'

/** Start options (AT-2): a chosen time, a starting severity, and "Woke up with it". */
export function StartForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation()
  const now = toInputs(nowMoment())
  const [date, setDate] = useState(now.date)
  const [time, setTime] = useState(now.time)
  const [severity, setSeverity] = useState(1)
  const [wokeUp, setWokeUp] = useState(false)
  const start = useStartAttack()

  function submit(event: FormEvent) {
    event.preventDefault()
    start.mutate({ at: momentFromLocal(date, time), severity, wokeUp }, { onSuccess: onDone })
  }

  return (
    <form className="stack" onSubmit={submit}>
      <label className="checkbox">
        <input type="checkbox" checked={wokeUp} onChange={(e) => setWokeUp(e.target.checked)} /> {t('start.wokeUp')}
      </label>
      <div className="form-row">
        <Field label={t('dose.date')}>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <Field label={wokeUp ? t('start.wokeUpAt') : t('dose.time')}>
          <input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
        </Field>
      </div>
      <FieldGroup label={t('start.severity')}>
        <SeverityButtons value={severity} onChange={setSeverity} min={1} />
      </FieldGroup>
      <ErrorText error={start.error} />
      <button type="submit" className="btn btn-primary btn-block" disabled={start.isPending}>
        {t('record.start')}
      </button>
    </form>
  )
}
