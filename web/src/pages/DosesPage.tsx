import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import type { DoseQuery } from '../api/endpoints'
import { useDoses, useIngredients, useMedications } from '../api/queries'
import { Card, PageHeader, QueryView } from '../components/ui'
import { formatQuantity } from '../lib/format'
import { clock } from '../lib/time'
import { DoseEditForm } from './AttackDoses'
import { when } from './AttackEditors'

type Choice = 'any' | 'yes' | 'no'
const flag = (choice: Choice) => (choice === 'any' ? undefined : choice === 'yes')

/** All doses, newest first, filtered by medication, ingredient, rated or not and attack or not (V-6); each is editable (DO-8). */
export function DosesPage() {
  const { t } = useTranslation()
  const medications = useMedications(true)
  const ingredients = useIngredients(true)
  const [medicationId, setMedicationId] = useState<number | undefined>(undefined)
  const [ingredientId, setIngredientId] = useState<number | undefined>(undefined)
  const [rated, setRated] = useState<Choice>('any')
  const [withAttack, setWithAttack] = useState<Choice>('any')
  const query: DoseQuery = { medicationId, ingredientId, rated: flag(rated), withAttack: flag(withAttack) }
  const filtered = Object.values(query).some((v) => v !== undefined)
  const doses = useDoses(query)
  const [editing, setEditing] = useState<number | null>(null)
  const archived = (name: string, isArchived: boolean) => (isArchived ? `${name} (${t('common.archived')})` : name)
  const id = (value: string) => (value ? Number(value) : undefined)

  return (
    <div className="page">
      <PageHeader title={t('doseList.title')} />
      <Card>
        <div className="filters">
          <select className="input input-inline" aria-label={t('doseList.medicationFilter')} value={medicationId ?? ''} onChange={(e) => setMedicationId(id(e.target.value))}>
            <option value="">{t('doseList.anyMedication')}</option>
            {medications.data?.map((m) => (
              <option key={m.id} value={m.id}>
                {archived(m.name, m.archived)}
              </option>
            ))}
          </select>
          <select className="input input-inline" aria-label={t('doseList.ingredientFilter')} value={ingredientId ?? ''} onChange={(e) => setIngredientId(id(e.target.value))}>
            <option value="">{t('doseList.anyIngredient')}</option>
            {ingredients.data?.map((i) => (
              <option key={i.id} value={i.id}>
                {archived(i.name, i.archived)}
              </option>
            ))}
          </select>
          <select className="input input-inline" aria-label={t('doseList.ratedFilter')} value={rated} onChange={(e) => setRated(e.target.value as Choice)}>
            <option value="any">{t('doseList.ratedAny')}</option>
            <option value="yes">{t('doseList.rated')}</option>
            <option value="no">{t('doseList.unrated')}</option>
          </select>
          <select className="input input-inline" aria-label={t('doseList.attackFilter')} value={withAttack} onChange={(e) => setWithAttack(e.target.value as Choice)}>
            <option value="any">{t('doseList.attackAny')}</option>
            <option value="yes">{t('doseList.withAttack')}</option>
            <option value="no">{t('doseList.withoutAttack')}</option>
          </select>
        </div>
        <QueryView query={doses}>
          {(list) =>
            list.length === 0 ? (
              <p className="empty">{filtered ? t('doseList.noMatches') : t('doseList.none')}</p>
            ) : (
              <ul className="edit-list">
                {list.map((dose) => (
                  <li key={dose.id}>
                    {editing === dose.id ? (
                      <DoseEditForm attackId={dose.attackId} dose={dose} onDone={() => setEditing(null)} />
                    ) : (
                      <div className="edit-row">
                        <span>
                          <span className="tnum">{when(dose.at)}</span> · {dose.medicationName} · {formatQuantity(dose.quantity)} {dose.doseUnit}
                          {dose.overLimit && <span className="badge badge-warning">{t('dose.overLimit')}</span>}
                          <small>
                            {dose.rating ? t(`rating.${dose.rating}`) + (dose.sustained === false ? ` · ${t('rating.notSustained')}` : '') : t('rating.notRated')}
                            {dose.attackId !== null && (
                              <>
                                {' · '}
                                <Link to={`/attacks/${dose.attackId}`}>{t('doseList.attack')}</Link>
                              </>
                            )}
                            {dose.note && ` · ${dose.note}`}
                          </small>
                        </span>
                        <button
                          type="button"
                          className="btn btn-ghost btn-small"
                          aria-label={t('doses.edit', { medication: dose.medicationName, time: clock(dose.at) })}
                          onClick={() => setEditing(dose.id)}
                        >
                          {t('common.edit')}
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )
          }
        </QueryView>
      </Card>
    </div>
  )
}
