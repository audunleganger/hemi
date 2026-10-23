import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import * as endpoints from '../api/endpoints'
import { useApiMutation, useAttack, useSymptoms, useTriggers } from '../api/queries'
import type { AttackDto, AttackStatus, Nausea, PainSide, TriggerDto } from '../api/types.gen'
import { AttackChart } from '../components/AttackChart'
import { HeadIcon, PainSidePicker } from '../components/HeadIcon'
import { useToast } from '../components/Toast'
import { Card, ConfirmButton, ErrorText, Field, QueryView } from '../components/ui'
import { clock, formatDuration, formatMomentDay, localDate } from '../lib/time'
import { useNow } from '../lib/useNow'
import { NauseaField, StatusField, TriggersField } from '../record/AttackFields'
import { useRecord } from '../record/RecordContext'
import { DosesEditor } from './AttackDoses'
import { EpisodesEditor, ReadingsEditor } from './AttackEditors'
import { symptomNames } from '../lib/symptoms'

/** An attack's page (V-5): its timeline, its doses, and its details, all editable (AT-12). */
export function AttackPage() {
  const { id } = useParams()
  const attack = useAttack(Number(id))
  const triggers = useTriggers(true)
  const now = useNow()
  return (
    <div className="page attack-page">
      <QueryView query={attack}>{(data) => <AttackView attack={data} triggers={triggers.data ?? []} now={now} />}</QueryView>
    </div>
  )
}

function AttackView({ attack, triggers, now }: { attack: AttackDto; triggers: TriggerDto[]; now: number }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const toast = useToast()
  const client = useQueryClient()
  // Not useApiMutation: refreshing everything at once would reload this deleted attack and get a 404.
  const remove = useMutation({
    mutationFn: () => endpoints.deleteAttack(attack.summary.id),
    onSuccess: () => {
      client.removeQueries({ queryKey: ['attacks', attack.summary.id] })
      toast.show(t('attackPage.deleted'))
      void navigate('/diary')
      void client.invalidateQueries({ predicate: (query) => query.queryKey[0] !== 'images' })
    },
  })
  const { summary } = attack
  const units = { d: t('units.d'), h: t('units.h'), min: t('units.min') }
  const endDiffers = summary.end && localDate(summary.end) !== localDate(summary.start)
  const span = summary.ongoing
    ? t('attackPage.since', { time: clock(summary.start) })
    : summary.end
      ? `${clock(summary.start)}–${endDiffers ? `${formatMomentDay(summary.end)} ` : ''}${clock(summary.end)}`
      : t('attackPage.noEnd', { time: clock(summary.start) })
  const duration = summary.ongoing ? now - summary.start.at : summary.end ? summary.end.at - summary.start.at : null
  const facts = [
    span,
    duration !== null ? formatDuration(duration, units) : null,
    summary.wokeUp ? t('day.wokeUp') : null,
    summary.episodeCount > 1 ? t('attacks.recurrences', { count: summary.episodeCount - 1 }) : null,
    summary.peak !== null ? t('attacks.peak', { severity: summary.peak }) : t('attacks.peakUnknown'),
  ].filter(Boolean)

  return (
    <>
      <Link to="/diary" className="back-link">
        ← {t('diary.title')}
      </Link>
      <header className="attack-page-header">
        <HeadIcon side={summary.painSide} severity={summary.peak} size={44} />
        <div>
          <h1>
            {formatMomentDay(summary.start)}
            {summary.ongoing && <span className="badge badge-info">{t('attacks.ongoing')}</span>}
          </h1>
          <p className="muted">{facts.join(' · ')}</p>
        </div>
      </header>
      <div className="attack-page-cols">
        <div className="stack">
          {attack.signs.length > 0 && (
            <Card title={t('signs.onAttack')}>
              <SignsBefore attack={attack} />
            </Card>
          )}
          <Card title={t('attackPage.timeline')}>
            <AttackChart attack={attack} now={now} />
          </Card>
          <Card title={t('episodes.title')}>
            <EpisodesEditor attack={attack} />
          </Card>
          <Card title={t('readings.title')}>
            <ReadingsEditor attack={attack} />
          </Card>
          <Card title={t('afterwards.doses')}>
            <DosesEditor attack={attack} />
          </Card>
        </div>
        <Card title={t('attackPage.details')}>
          {/* Keyed by the last change, so the form starts over from what the server saved. */}
          <DetailsForm key={attack.updatedAt} attack={attack} triggers={triggers} onSaved={() => toast.show(t('attackPage.saved'))} />
        </Card>
      </div>
      <Card className="danger-zone">
        <div className="row-actions">
          <ConfirmButton
            className="btn btn-ghost"
            disabled={remove.isPending}
            onConfirm={() => remove.mutate()}
          >
            {t('attackPage.delete')}
          </ConfirmButton>
          <span className="field-hint">{attack.doses.length > 0 ? t('attackPage.deleteKeepsDoses', { count: attack.doses.length }) : t('attackPage.deleteHint')}</span>
        </div>
        <ErrorText error={remove.error} />
      </Card>
    </>
  )
}

/** The warning signs that came before the attack (WS-3); each opens for editing (WS-5). */
function SignsBefore({ attack }: { attack: AttackDto }) {
  const { t } = useTranslation()
  const record = useRecord()
  const symptoms = useSymptoms(true)
  const units = { d: t('units.d'), h: t('units.h'), min: t('units.min') }
  return (
    <ul className="sign-list">
      {attack.signs.map((sign) => {
        const names = symptomNames(sign.symptomIds, symptoms.data)
        const before = sign.attackStart && sign.attackStart.at > sign.at.at ? t('signs.beforeAttack', { time: formatDuration(sign.attackStart.at - sign.at.at, units) }) : null
        return (
          <li key={sign.id}>
            <button type="button" className="link-button" onClick={() => record.open({ kind: 'sign', sign })}>
              {clock(sign.at)}
              {before && ` · ${before}`}
            </button>
            <span>{[names.length > 0 ? names.join(', ') : t('signs.noSymptoms'), sign.note].filter(Boolean).join(' · ')}</span>
          </li>
        )
      })}
    </ul>
  )
}

/** Status, nausea, pain side, triggers and note (AT-4, AT-8 … AT-11), saved together. */
function DetailsForm({ attack, triggers, onSaved }: { attack: AttackDto; triggers: TriggerDto[]; onSaved: () => void }) {
  const { t } = useTranslation()
  const { summary } = attack
  const [status, setStatus] = useState<AttackStatus>(summary.status)
  const [nausea, setNausea] = useState<Nausea | null>(summary.nausea)
  const [painSide, setPainSide] = useState<PainSide | null>(summary.painSide)
  const [triggerIds, setTriggerIds] = useState<number[]>(summary.triggerIds)
  const [note, setNote] = useState(attack.note ?? '')
  const save = useApiMutation(() => endpoints.updateAttack(summary.id, { status, nausea, painSide, triggerIds, note: note.trim() || null }))
  const sameTriggers = triggerIds.length === summary.triggerIds.length && triggerIds.every((id) => summary.triggerIds.includes(id))
  const changed = status !== summary.status || nausea !== summary.nausea || painSide !== summary.painSide || !sameTriggers || note.trim() !== (attack.note ?? '')

  function submit(event: FormEvent) {
    event.preventDefault()
    save.mutate(undefined, { onSuccess: onSaved })
  }

  return (
    <form className="stack" onSubmit={submit}>
      <StatusField value={status} onChange={setStatus} />
      <NauseaField value={nausea} onChange={setNausea} />
      <div className="field">
        <span className="field-label">{t('painSide.label')}</span>
        <PainSidePicker value={painSide} onChange={setPainSide} />
      </div>
      <TriggersField triggers={triggers} value={triggerIds} onChange={setTriggerIds} />
      <Field label={t('dose.note')}>
        <textarea className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <ErrorText error={save.error} />
      <button type="submit" className="btn btn-primary" disabled={!changed || save.isPending}>
        {t('common.save')}
      </button>
    </form>
  )
}
