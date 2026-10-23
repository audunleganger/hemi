import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import * as endpoints from '../api/endpoints'
import { useApiMutation, useHome, useSymptoms } from '../api/queries'
import type { Moment, SymptomDto, WarningSignDto } from '../api/types.gen'
import { ConfirmButton, ErrorText, Field, FieldGroup } from '../components/ui'
import { clock, formatMomentDay, nowMoment } from '../lib/time'
import { useNow } from '../lib/useNow'
import { MomentFields, useMomentInputs } from '../pages/AttackEditors'
import { useStartAttack } from './useStartAttack'

const DAY = 24 * 60 * 60 * 1000

/** Symptom toggles (WS-2). Archived symptoms are shown only while they're on. */
export function SymptomsField({ symptoms, value, onChange }: { symptoms: SymptomDto[]; value: number[]; onChange: (ids: number[]) => void }) {
  const { t } = useTranslation()
  const shown = symptoms.filter((symptom) => !symptom.archived || value.includes(symptom.id))
  if (shown.length === 0) return null
  return (
    <FieldGroup label={t('signs.symptoms')}>
      <div className="chips">
        {shown.map((symptom) => {
          const on = value.includes(symptom.id)
          return (
            <button key={symptom.id} type="button" className={`chip ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => onChange(on ? value.filter((id) => id !== symptom.id) : [...value, symptom.id])}>
              {symptom.name}
            </button>
          )
        })}
      </div>
    </FieldGroup>
  )
}

/**
 * Log or edit warning signs (WS-1, WS-5): a time, symptom toggles and a note. Editing also offers delete and
 * "It's starting" (WS-4), which starts an attack from the sign's time, or for older signs opens Log afterwards.
 */
export function SignForm({
  sign,
  onDone,
  onAfterwards,
}: {
  sign?: WarningSignDto
  onDone: (message: string) => void
  onAfterwards: (start: Moment) => void
}) {
  const { t } = useTranslation()
  const symptoms = useSymptoms(true)
  const home = useHome()
  const start = useStartAttack()
  const now = useNow()
  const at = useMomentInputs(sign?.at ?? nowMoment())
  const [symptomIds, setSymptomIds] = useState<number[]>(sign?.symptomIds ?? [])
  const [note, setNote] = useState(sign?.note ?? '')
  const save = useApiMutation(() => {
    const input = { at: at.moment(), symptomIds, note: note.trim() || null }
    return sign ? endpoints.updateSign(sign.id, input) : endpoints.createSign(input)
  })
  const remove = useApiMutation(() => endpoints.deleteSign(sign!.id))

  function submit(event: FormEvent) {
    event.preventDefault()
    save.mutate(undefined, { onSuccess: () => onDone(sign ? t('signs.updated') : t('signs.saved')) })
  }

  const live = sign && !home.data?.ongoing && now - sign.at.at <= DAY
  const startFromSign = () => {
    if (!sign) return
    if (live) start.mutate({ at: sign.at }, { onSuccess: () => onDone('') })
    else onAfterwards(sign.at)
  }

  return (
    <form className="stack" onSubmit={submit}>
      {!sign && <p className="field-hint">{t('record.signHint')}</p>}
      <MomentFields labels={[t('dose.date'), t('dose.time')]} inputs={at} required />
      <SymptomsField symptoms={symptoms.data ?? []} value={symptomIds} onChange={setSymptomIds} />
      <Field label={t('dose.note')}>
        <textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      {sign?.attackStart && <p className="field-hint">{t('signs.before', { day: formatMomentDay(sign.attackStart) })}</p>}
      <ErrorText error={save.error ?? remove.error ?? start.error} />
      <button type="submit" className="btn btn-primary btn-block" disabled={save.isPending}>
        {sign ? t('common.save') : t('signs.save')}
      </button>
      {sign && !sign.attackId && (
        <button type="button" className="record-option" disabled={start.isPending} onClick={startFromSign}>
          {live ? t('signs.starting') : t('signs.startingAfterwards')}
          <small>{live ? t('signs.startingHint', { time: clock(sign.at) }) : t('signs.startingAfterwardsHint', { time: `${formatMomentDay(sign.at)} ${clock(sign.at)}` })}</small>
        </button>
      )}
      {sign && (
        <div className="row-actions">
          <ConfirmButton className="btn btn-ghost" disabled={remove.isPending} onConfirm={() => remove.mutate(undefined, { onSuccess: () => onDone(t('signs.deleted')) })}>
            {t('signs.delete')}
          </ConfirmButton>
        </div>
      )}
    </form>
  )
}
