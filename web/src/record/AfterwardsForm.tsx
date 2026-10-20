import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import * as endpoints from '../api/endpoints'
import { useApiMutation, useMedications, useTriggers } from '../api/queries'
import type { AttackStatus, Nausea, PainSide, PastDoseInput, Rating } from '../api/types.gen'
import { DecimalInput } from '../components/DecimalInput'
import { PainSidePicker } from '../components/HeadIcon'
import { ErrorText, Field, FieldGroup } from '../components/ui'
import { addDays } from '../lib/dates'
import { parseDecimal } from '../lib/format'
import { momentFromLocal, nowMoment, toInputs } from '../lib/time'
import { NauseaField, StatusField, TriggersField } from './AttackFields'
import { RATINGS } from './RatingPrompt'

interface DoseRow {
  key: number
  medicationId: number | null
  quantity: string
  time: string
  rating: Rating | ''
}

/**
 * Log an attack that is over (AT-14), e.g. "yesterday 14:00–22:00". Only the start is required; everything
 * else can be filled in now, later or never (AT-15).
 */
export function AfterwardsForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation()
  const medications = useMedications()
  const triggers = useTriggers()
  const yesterday = addDays(toInputs(nowMoment()).date, -1)
  const [startDate, setStartDate] = useState(yesterday)
  const [startTime, setStartTime] = useState('14:00')
  const [endDate, setEndDate] = useState(yesterday)
  const [endTime, setEndTime] = useState('')
  const [peak, setPeak] = useState<number | null>(null)
  const [status, setStatus] = useState<AttackStatus>('migraine')
  const [nausea, setNausea] = useState<Nausea | null>(null)
  const [painSide, setPainSide] = useState<PainSide | null>(null)
  const [triggerIds, setTriggerIds] = useState<number[]>([])
  const [note, setNote] = useState('')
  const [doses, setDoses] = useState<DoseRow[]>([])
  const save = useApiMutation(endpoints.logAfterwards)
  const active = medications.data?.filter((m) => !m.archived) ?? []

  function submit(event: FormEvent) {
    event.preventDefault()
    const pastDoses: PastDoseInput[] = doses
      .filter((d) => d.medicationId !== null)
      .map((d) => ({
        medicationId: d.medicationId!,
        quantity: parseDecimal(d.quantity),
        at: momentFromLocal(startDate, d.time || startTime),
        rating: d.rating || null,
      }))
    save.mutate(
      {
        start: momentFromLocal(startDate, startTime),
        end: endTime ? momentFromLocal(endDate, endTime) : null,
        peakSeverity: peak,
        status,
        nausea,
        painSide,
        triggerIds,
        note: note || null,
        doses: pastDoses,
      },
      { onSuccess: onDone },
    )
  }

  const updateDose = (key: number, patch: Partial<DoseRow>) => setDoses((all) => all.map((d) => (d.key === key ? { ...d, ...patch } : d)))

  return (
    <form className="stack" onSubmit={submit}>
      <div className="form-row">
        <Field label={t('afterwards.startDate')}>
          <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
        </Field>
        <Field label={t('afterwards.startTime')}>
          <input className="input" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
        </Field>
      </div>
      <div className="form-row">
        <Field label={t('afterwards.endDate')}>
          <input className="input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </Field>
        <Field label={t('afterwards.endTime')} hint={t('afterwards.optional')}>
          <input className="input" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </Field>
      </div>
      <FieldGroup label={t('afterwards.peak')} hint={t('afterwards.peakHint')}>
        <div className="segmented" role="group">
          {[1, 2, 3].map((s) => (
            <button key={s} type="button" className={peak === s ? 'active' : ''} aria-pressed={peak === s} onClick={() => setPeak(peak === s ? null : s)}>
              {s} {t(`severity.s${s}` as 'severity.s0')}
            </button>
          ))}
        </div>
      </FieldGroup>
      <details className="more-details">
        <summary>{t('afterwards.details')}</summary>
        <div className="stack">
          <StatusField value={status} onChange={setStatus} />
          <NauseaField value={nausea} onChange={setNausea} />
          <div className="field">
            <span className="field-label">{t('painSide.label')}</span>
            <PainSidePicker value={painSide} onChange={setPainSide} />
          </div>
          <TriggersField triggers={triggers.data ?? []} value={triggerIds} onChange={setTriggerIds} />
          <Field label={t('dose.note')}>
            <textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
      </details>
      <div className="stack">
        <span className="field-label">{t('afterwards.doses')}</span>
        {doses.map((dose) => (
          <div key={dose.key} className="dose-row">
            <select className="input" aria-label={t('dose.medication')} value={dose.medicationId ?? ''} onChange={(e) => updateDose(dose.key, { medicationId: Number(e.target.value) })}>
              <option value="" disabled>
                {t('dose.medication')}
              </option>
              {active.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <DecimalInput aria-label={t('dose.quantity')} placeholder="1" value={dose.quantity} onChange={(v) => updateDose(dose.key, { quantity: v })} />
            <input className="input" type="time" aria-label={t('dose.time')} value={dose.time} onChange={(e) => updateDose(dose.key, { time: e.target.value })} />
            <select className="input" aria-label={t('rating.label')} value={dose.rating} onChange={(e) => updateDose(dose.key, { rating: e.target.value as Rating | '' })}>
              <option value="">{t('rating.notRated')}</option>
              {RATINGS.map((r) => (
                <option key={r} value={r}>
                  {t(`rating.${r}`)}
                </option>
              ))}
            </select>
            <button type="button" className="btn btn-ghost btn-small btn-icon" aria-label={t('common.remove')} onClick={() => setDoses(doses.filter((d) => d.key !== dose.key))}>
              ✕
            </button>
          </div>
        ))}
        <div>
          <button
            type="button"
            className="btn btn-small"
            disabled={active.length === 0}
            onClick={() => setDoses([...doses, { key: Date.now(), medicationId: active[0]?.id ?? null, quantity: '', time: startTime, rating: '' }])}
          >
            {t('afterwards.addDose')}
          </button>
        </div>
      </div>
      <ErrorText error={save.error} />
      <button type="submit" className="btn btn-primary btn-block" disabled={save.isPending}>
        {t('afterwards.save')}
      </button>
    </form>
  )
}
