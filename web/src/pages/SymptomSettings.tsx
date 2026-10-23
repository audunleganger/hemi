import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import * as endpoints from '../api/endpoints'
import { useApiMutation, useSymptoms } from '../api/queries'
import type { SymptomDto } from '../api/types.gen'
import { Badge, Card, ConfirmButton, ErrorText, QueryView } from '../components/ui'

function SymptomRow({ symptom, index, all }: { symptom: SymptomDto; index: number; all: SymptomDto[] }) {
  const { t } = useTranslation()
  const [name, setName] = useState<string | null>(null)
  const rename = useApiMutation((value: string) => endpoints.renameSymptom(symptom.id, value))
  const archive = useApiMutation(() => endpoints.archiveSymptom(symptom.id, !symptom.archived))
  const remove = useApiMutation(() => endpoints.deleteSymptom(symptom.id))
  const reorder = useApiMutation(endpoints.reorderSymptoms)
  const move = (delta: number) => {
    const ids = all.map((s) => s.id)
    ids.splice(index, 1)
    ids.splice(index + delta, 0, symptom.id)
    reorder.mutate(ids)
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (name !== null) rename.mutate(name, { onSuccess: () => setName(null) })
  }

  return (
    <li className={symptom.archived ? 'archived' : ''}>
      {name !== null ? (
        <form className="medication-main inline-form" onSubmit={submit}>
          <input className="input" aria-label={t('signs.rename')} value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
          <button type="submit" className="btn btn-small btn-primary" disabled={rename.isPending}>
            {t('common.save')}
          </button>
          <button type="button" className="btn btn-small btn-ghost" onClick={() => setName(null)}>
            {t('common.cancel')}
          </button>
        </form>
      ) : (
        <span className="medication-main">
          <b>{symptom.name}</b>
          <small>{t('signs.used', { count: symptom.signCount })}</small>
        </span>
      )}
      {symptom.archived && <Badge>{t('common.archived')}</Badge>}
      {name === null && (
        <span className="row-actions">
          <button type="button" className="btn btn-ghost btn-small btn-icon" aria-label={t('signs.moveUp')} disabled={index === 0 || reorder.isPending} onClick={() => move(-1)}>
            ↑
          </button>
          <button type="button" className="btn btn-ghost btn-small btn-icon" aria-label={t('signs.moveDown')} disabled={index === all.length - 1 || reorder.isPending} onClick={() => move(1)}>
            ↓
          </button>
          <button type="button" className="btn btn-small" onClick={() => setName(symptom.name)}>
            {t('signs.rename')}
          </button>
          <button type="button" className="btn btn-ghost btn-small" onClick={() => archive.mutate(undefined)}>
            {symptom.archived ? t('common.unarchive') : t('common.archive')}
          </button>
          <ConfirmButton className="btn btn-ghost btn-small" onConfirm={() => remove.mutate(undefined)}>
            {t('common.delete')}
          </ConfirmButton>
        </span>
      )}
      <ErrorText error={rename.error ?? archive.error ?? remove.error ?? reorder.error} />
    </li>
  )
}

/** The symptoms offered when logging warning signs (WS-2): add, rename, reorder, archive, delete. */
export function SymptomSettings() {
  const { t } = useTranslation()
  const symptoms = useSymptoms(true)
  const [name, setName] = useState('')
  const create = useApiMutation(endpoints.createSymptom)

  function submit(event: FormEvent) {
    event.preventDefault()
    create.mutate(name, { onSuccess: () => setName('') })
  }

  return (
    <Card title={t('signs.settingsTitle')}>
      <p className="field-hint">{t('signs.settingsHint')}</p>
      <QueryView query={symptoms}>
        {(list) => (
          <ul className="medication-list">
            {list.map((symptom, index) => (
              <SymptomRow key={symptom.id} symptom={symptom} index={index} all={list} />
            ))}
          </ul>
        )}
      </QueryView>
      <form className="inline-form" onSubmit={submit}>
        <input className="input" aria-label={t('signs.newName')} placeholder={t('signs.newName')} value={name} onChange={(e) => setName(e.target.value)} required />
        <button type="submit" className="btn" disabled={create.isPending}>
          {t('signs.add')}
        </button>
      </form>
      <ErrorText error={create.error} />
    </Card>
  )
}
