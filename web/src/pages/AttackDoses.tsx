import { useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import * as endpoints from '../api/endpoints'
import { useApiMutation, useMedications } from '../api/queries'
import type { AttackDto, DoseDto, Moment, Rating } from '../api/types.gen'
import { DecimalInput } from '../components/DecimalInput'
import { useToast } from '../components/Toast'
import { ConfirmButton, ErrorText, Field } from '../components/ui'
import { formatQuantity, parseDecimal, toInputValue } from '../lib/format'
import { clock, nowMoment } from '../lib/time'
import { useDebounced } from '../lib/useDebounced'
import { LimitPreview } from '../record/LimitPreview'
import { RATINGS } from '../record/RatingPrompt'
import { MomentFields, useMomentInputs, when } from './AttackEditors'

/** The attack's doses (DO-8, AT-12): add one afterwards, change any of its parts or its rating, or delete it. */
export function DosesEditor({ attack }: { attack: AttackDto }) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState<number | 'new' | null>(null)
  return (
    <div className="stack">
      {attack.doses.length === 0 && editing !== 'new' && <p className="empty">{t('attackPage.noDoses')}</p>}
      <ul className="edit-list">
        {attack.doses.map((dose) => (
          <li key={dose.id}>
            {editing === dose.id ? (
              <DoseEditForm attack={attack} dose={dose} onDone={() => setEditing(null)} />
            ) : (
              <div className="edit-row">
                <span>
                  <span className="tnum">{when(dose.at, attack.summary.start)}</span> · {dose.medicationName} · {formatQuantity(dose.quantity)} {dose.doseUnit}
                  {dose.overLimit && <span className="badge badge-warning">{t('dose.overLimit')}</span>}
                  <small>
                    {[
                      dose.rating ? t(`rating.${dose.rating}`) + (dose.sustained === false ? ` · ${t('rating.notSustained')}` : '') : t('rating.notRated'),
                      dose.note,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </small>
                </span>
                <button type="button" className="btn btn-ghost btn-small" aria-label={t('doses.edit', { medication: dose.medicationName, time: clock(dose.at) })} onClick={() => setEditing(dose.id)}>
                  {t('common.edit')}
                </button>
              </div>
            )}
          </li>
        ))}
        {editing === 'new' && (
          <li>
            <DoseEditForm attack={attack} dose={null} onDone={() => setEditing(null)} />
          </li>
        )}
      </ul>
      {editing !== 'new' && (
        <div>
          <button type="button" className="btn btn-small" onClick={() => setEditing('new')}>
            {t('doses.add')}
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * Edits a dose, or adds one to the attack when [dose] is null. Shows the limit preview and asks before going
 * over a limit (LI-4), like logging a dose.
 */
function DoseEditForm({ attack, dose, onDone }: { attack: AttackDto; dose: DoseDto | null; onDone: () => void }) {
  const { t } = useTranslation()
  const toast = useToast()
  const medications = useMedications(true)
  // Archived medications are offered only when the dose already is one (ME-5).
  const choices = medications.data?.filter((m) => !m.archived || m.id === dose?.medicationId) ?? []
  const [medicationId, setMedicationId] = useState<number | null>(dose?.medicationId ?? null)
  const medication = choices.find((m) => m.id === medicationId) ?? choices[0]
  const [quantity, setQuantity] = useState<string | null>(dose ? toInputValue(dose.quantity) : null)
  const at = useMomentInputs(dose?.at ?? nowMoment())
  const [rating, setRating] = useState<Rating | ''>(dose?.rating ?? '')
  const [note, setNote] = useState(dose?.note ?? '')
  const [inAttack, setInAttack] = useState(true)
  const [confirming, setConfirming] = useState(false)

  const quantityValue = quantity === null ? (medication?.defaultQuantity ?? 1) : parseDecimal(quantity)
  const valid = medication !== undefined && quantityValue !== null && !Number.isNaN(quantityValue) && quantityValue > 0
  const moment = at.moment()
  // Debounced as a string: a new object every render would never settle.
  const previewKey = useDebounced(JSON.stringify(valid && moment ? { medicationId: medication.id, quantity: quantityValue, at: moment, doseId: dose?.id ?? null } : null))
  const preview = useQuery({
    queryKey: ['preview', previewKey],
    queryFn: () => endpoints.previewDose(JSON.parse(previewKey)),
    // Checked on the debounced value: the form may have been incomplete a moment ago.
    enabled: previewKey !== 'null',
    placeholderData: (previous) => previous,
  })

  const save = useApiMutation(async () => {
    const input = { medicationId: medication!.id, quantity: quantityValue, at: moment, note: note.trim() || null, attackId: inAttack ? attack.summary.id : null, autoAttack: false }
    const saved = dose ? await endpoints.updateDose(dose.id, input) : await endpoints.createDose(input)
    if (rating && rating !== saved.rating) {
      // A changed rating keeps when it was first rated, as long as that's still after the dose (DO-5).
      const ratedAt: Moment | null = saved.ratedAt !== null && saved.ratedAt >= saved.at.at ? { at: saved.ratedAt, offset: saved.at.offset } : null
      return endpoints.rateDose(saved.id, { rating, at: ratedAt })
    }
    return saved
  })
  const remove = useApiMutation(() => endpoints.deleteDose(dose!.id))

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!valid || !moment) return
    if (preview.data?.over && !confirming) {
      setConfirming(true)
      return
    }
    save.mutate(undefined, {
      onSuccess: (saved) => {
        if (!inAttack) toast.show(t('doses.movedOut', { medication: saved.medicationName }))
        onDone()
      },
    })
  }

  return (
    <form className="stack edit-form" onSubmit={submit}>
      <div className="form-row">
        <Field label={t('dose.medication')}>
          <select
            className="input"
            value={medication?.id ?? ''}
            onChange={(e) => {
              setMedicationId(Number(e.target.value))
              setQuantity(null)
              setConfirming(false)
            }}
          >
            {choices.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('dose.quantity')} hint={medication ? (quantityValue === 1 ? medication.doseUnit : medication.doseUnitPlural || medication.doseUnit) : undefined}>
          <DecimalInput
            value={quantity ?? toInputValue(medication?.defaultQuantity ?? 1)}
            onChange={(v) => {
              setQuantity(v)
              setConfirming(false)
            }}
          />
        </Field>
      </div>
      <MomentFields labels={[t('dose.date'), t('dose.time')]} inputs={at} required />
      <Field label={t('rating.label')}>
        <select className="input" value={rating} onChange={(e) => setRating(e.target.value as Rating | '')}>
          {/* The server can rate a dose but not unrate it, so "Not rated" is there only until it's rated. */}
          {!dose?.rating && <option value="">{t('rating.notRated')}</option>}
          {RATINGS.map((r) => (
            <option key={r} value={r}>
              {t(`rating.${r}`)}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t('dose.note')}>
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      {dose && (
        <label className="checkbox">
          <input type="checkbox" checked={inAttack} onChange={(e) => setInAttack(e.target.checked)} /> {t('doses.inThisAttack')}
        </label>
      )}
      {!inAttack && <p className="field-hint">{t('doses.outHint')}</p>}
      <LimitPreview preview={preview.data} />
      {confirming && (
        <p className="warning-text" role="alert">
          {t('dose.confirmOver')}
        </p>
      )}
      <ErrorText error={save.error ?? remove.error} />
      <div className="row-actions">
        <button type="submit" className={`btn ${confirming ? 'btn-danger' : 'btn-primary'}`} disabled={!valid || save.isPending}>
          {confirming ? t('dose.saveAnyway') : t('common.save')}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onDone}>
          {t('common.cancel')}
        </button>
        {dose && (
          <ConfirmButton className="btn btn-ghost" disabled={remove.isPending} onConfirm={() => remove.mutate(undefined, { onSuccess: onDone })}>
            {t('doses.delete')}
          </ConfirmButton>
        )}
      </div>
    </form>
  )
}
