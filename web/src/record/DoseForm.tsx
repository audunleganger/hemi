import { useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import * as endpoints from '../api/endpoints'
import { useApiMutation, useHome, useMedications } from '../api/queries'
import type { DoseDto } from '../api/types.gen'
import { DecimalInput } from '../components/DecimalInput'
import { SeverityButtons } from '../components/SeverityButtons'
import { ErrorText, Field, FieldGroup } from '../components/ui'
import { parseDecimal, toInputValue } from '../lib/format'
import { momentFromLocal, nowMoment, toInputs } from '../lib/time'
import { useDebounced } from '../lib/useDebounced'
import { LimitPreview } from './LimitPreview'

/**
 * Logs a dose (DO-1): medication (most used first), quantity, time, and in an attack the current severity
 * (DO-2). The limit preview updates as it's filled in, and going over a limit asks to confirm (LI-4).
 */
export function DoseForm({ initialMedicationId, onDone }: { initialMedicationId?: number; onDone: (dose: DoseDto) => void }) {
  const { t } = useTranslation()
  const medications = useMedications()
  const home = useHome()
  const ongoing = home.data?.ongoing ?? null
  const active = medications.data?.filter((m) => !m.archived) ?? []
  const [medicationId, setMedicationId] = useState<number | null>(initialMedicationId ?? null)
  const medication = active.find((m) => m.id === medicationId) ?? active[0]
  const [quantity, setQuantity] = useState<string | null>(null)
  const now = toInputs(nowMoment())
  const [date, setDate] = useState(now.date)
  const [time, setTime] = useState(now.time)
  // Until the time is changed it means "now", to the second, so doses a moment ago are counted.
  const [timeEdited, setTimeEdited] = useState(false)
  const [inAttack, setInAttack] = useState(true)
  const lastSeverity = ongoing?.readings.at(-1)?.severity ?? null
  const [severity, setSeverity] = useState<number | null>(lastSeverity)
  const [note, setNote] = useState('')
  const [confirming, setConfirming] = useState(false)

  const quantityValue = quantity === null ? (medication?.defaultQuantity ?? 1) : parseDecimal(quantity)
  const at = timeEdited ? momentFromLocal(date, time) : null
  const input = useDebounced({ medicationId: medication?.id, quantity: quantityValue, at })
  const preview = useQuery({
    queryKey: ['preview', input],
    queryFn: () => endpoints.previewDose({ medicationId: input.medicationId!, quantity: input.quantity, at: input.at }),
    enabled: input.medicationId !== undefined && input.quantity !== null && !Number.isNaN(input.quantity) && input.quantity > 0,
    placeholderData: (previous) => previous,
  })
  const save = useApiMutation(endpoints.createDose)
  const attackId = ongoing && inAttack ? ongoing.summary.id : null
  const valid = medication !== undefined && quantityValue !== null && !Number.isNaN(quantityValue) && quantityValue > 0

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!valid || !medication) return
    if (preview.data?.over && !confirming) {
      setConfirming(true)
      return
    }
    save.mutate(
      { medicationId: medication.id, quantity: quantityValue, at, note: note || null, attackId, autoAttack: false, severity: attackId ? severity : null },
      { onSuccess: onDone },
    )
  }

  if (medications.data && active.length === 0) return <p className="muted">{t('dose.noMedications')}</p>

  return (
    <form className="stack" onSubmit={submit}>
      <Field label={t('dose.medication')}>
        <select className="input" value={medication?.id ?? ''} onChange={(e) => {
          setMedicationId(Number(e.target.value))
          setQuantity(null)
          setConfirming(false)
        }}>
          {active.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </Field>
      <div className="form-row">
        <Field label={t('dose.quantity')} hint={medication ? (quantityValue === 1 ? medication.doseUnit : medication.doseUnitPlural || medication.doseUnit) : undefined}>
          <DecimalInput value={quantity ?? toInputValue(medication?.defaultQuantity ?? 1)} onChange={(v) => {
            setQuantity(v)
            setConfirming(false)
          }} />
        </Field>
        <Field label={t('dose.date')}>
          <input className="input" type="date" value={date} onChange={(e) => {
            setDate(e.target.value)
            setTimeEdited(true)
          }} required />
        </Field>
        <Field label={t('dose.time')}>
          <input className="input" type="time" value={time} onChange={(e) => {
            setTime(e.target.value)
            setTimeEdited(true)
          }} required />
        </Field>
      </div>
      {ongoing && (
        <label className="checkbox">
          <input type="checkbox" checked={inAttack} onChange={(e) => setInAttack(e.target.checked)} /> {t('dose.inAttack')}
        </label>
      )}
      {attackId && (
        <FieldGroup label={t('dose.severityNow')}>
          <SeverityButtons value={severity} onChange={setSeverity} />
        </FieldGroup>
      )}
      <Field label={t('dose.note')}>
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <LimitPreview preview={preview.data} />
      {confirming && <p className="warning-text" role="alert">{t('dose.confirmOver')}</p>}
      <ErrorText error={save.error} />
      <button type="submit" className={`btn btn-block ${confirming ? 'btn-danger' : 'btn-primary'}`} disabled={!valid || save.isPending}>
        {confirming ? t('dose.saveAnyway') : t('dose.save')}
      </button>
    </form>
  )
}
