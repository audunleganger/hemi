import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import * as endpoints from '../api/endpoints'
import { useApiMutation, useIngredients, useMedications } from '../api/queries'
import type { IngredientDto, LimitKind, MedicationDto, MedicationIngredientInput, MedicationInput } from '../api/types.gen'
import { DecimalInput } from '../components/DecimalInput'
import { Sheet } from '../components/Sheet'
import { Badge, Card, ConfirmButton, Empty, ErrorText, Field, PageHeader, QueryView } from '../components/ui'
import { formatNumber, parseDecimal, toInputValue } from '../lib/format'
import { limitSentence } from '../lib/limits'

const UNITS = ['mg', 'µg', 'g', 'ml', 'IU']
const KINDS: LimitKind[] = ['days', 'doses', 'amount', 'min_interval']
type WindowUnit = 'hours' | 'days' | 'weeks' | 'month'
const WINDOW_MINUTES: Record<WindowUnit, number> = { hours: 60, days: 24 * 60, weeks: 7 * 24 * 60, month: 30 * 24 * 60 }

interface IngredientRow {
  key: number
  ingredientId: number | null
  amount: string
}

/** Create or edit a medication or remedy (ME-1 … ME-3). New ingredients can be made on the spot. */
function MedicationEditor({ medication, ingredients, onDone }: { medication?: MedicationDto; ingredients: IngredientDto[]; onDone: () => void }) {
  const { t } = useTranslation()
  const [name, setName] = useState(medication?.name ?? '')
  const [doseUnit, setDoseUnit] = useState(medication?.doseUnit ?? t('medications.defaultUnit'))
  const [plural, setPlural] = useState(medication?.doseUnitPlural ?? t('medications.defaultPlural'))
  const [quantity, setQuantity] = useState(toInputValue(medication?.defaultQuantity ?? 1))
  const [followUp, setFollowUp] = useState(medication?.followUpMinutes ? String(medication.followUpMinutes) : '')
  const [rows, setRows] = useState<IngredientRow[]>(
    medication?.ingredients.map((i, key) => ({ key, ingredientId: i.ingredientId, amount: toInputValue(i.amountPerUnit) })) ?? [],
  )
  const [newIngredient, setNewIngredient] = useState({ name: '', unit: 'mg' })
  const createIngredient = useApiMutation(endpoints.createIngredient)
  const save = useApiMutation((input: MedicationInput) => (medication ? endpoints.updateMedication(medication.id, input) : endpoints.createMedication(input)))
  const active = ingredients.filter((i) => !i.archived || rows.some((r) => r.ingredientId === i.id))

  function submit(event: FormEvent) {
    event.preventDefault()
    const links: MedicationIngredientInput[] = rows.filter((r) => r.ingredientId !== null).map((r) => ({ ingredientId: r.ingredientId!, amountPerUnit: parseDecimal(r.amount) }))
    save.mutate(
      {
        name,
        kind: 'acute',
        doseUnit,
        doseUnitPlural: plural,
        defaultQuantity: parseDecimal(quantity) ?? 1,
        followUpMinutes: followUp ? Number(followUp) : null,
        ingredients: links,
      },
      { onSuccess: onDone },
    )
  }

  function addIngredient() {
    if (!newIngredient.name.trim()) return
    createIngredient.mutate(
      { name: newIngredient.name, measureUnit: newIngredient.unit },
      {
        onSuccess: (created) => {
          setRows([...rows, { key: Date.now(), ingredientId: created.id, amount: '' }])
          setNewIngredient({ name: '', unit: newIngredient.unit })
        },
      },
    )
  }

  const update = (key: number, patch: Partial<IngredientRow>) => setRows(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  return (
    <form className="stack" onSubmit={submit}>
      <Field label={t('medications.name')} hint={t('medications.nameHint')}>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
      </Field>
      <div className="form-row">
        <Field label={t('medications.doseUnit')}>
          <input className="input" value={doseUnit} onChange={(e) => setDoseUnit(e.target.value)} required />
        </Field>
        <Field label={t('medications.plural')}>
          <input className="input" value={plural} onChange={(e) => setPlural(e.target.value)} />
        </Field>
        <Field label={t('medications.defaultQuantity')}>
          <DecimalInput value={quantity} onChange={setQuantity} />
        </Field>
      </div>
      <Field label={t('medications.followUp')} hint={t('medications.followUpHint')}>
        <input className="input" type="number" min={1} max={1440} value={followUp} onChange={(e) => setFollowUp(e.target.value)} placeholder="120" />
      </Field>
      <div className="stack">
        <span className="field-label">{t('medications.ingredients')}</span>
        <p className="field-hint">{t('medications.ingredientsHint')}</p>
        {rows.map((row) => {
          const ingredient = ingredients.find((i) => i.id === row.ingredientId)
          return (
            <div key={row.key} className="ingredient-row">
              <select className="input" aria-label={t('medications.ingredient')} value={row.ingredientId ?? ''} onChange={(e) => update(row.key, { ingredientId: Number(e.target.value) })}>
                <option value="" disabled>
                  {t('medications.ingredient')}
                </option>
                {active.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
              <DecimalInput aria-label={t('medications.amountPerUnit', { unit: doseUnit })} placeholder={t('medications.amountUnknown')} value={row.amount} onChange={(v) => update(row.key, { amount: v })} />
              <span className="muted unit-label">
                {ingredient?.measureUnit ?? ''} / {doseUnit}
              </span>
              <button type="button" className="btn btn-ghost btn-small btn-icon" aria-label={t('common.remove')} onClick={() => setRows(rows.filter((r) => r.key !== row.key))}>
                ✕
              </button>
            </div>
          )
        })}
        <div className="row-actions">
          <button type="button" className="btn btn-small" disabled={active.length === 0} onClick={() => setRows([...rows, { key: Date.now(), ingredientId: active[0]?.id ?? null, amount: '' }])}>
            {t('medications.addIngredient')}
          </button>
        </div>
        <div className="inline-form new-ingredient">
          <Field label={t('medications.newIngredient')}>
            <input className="input" value={newIngredient.name} onChange={(e) => setNewIngredient({ ...newIngredient, name: e.target.value })} placeholder={t('medications.newIngredientPlaceholder')} />
          </Field>
          <Field label={t('medications.measureUnit')}>
            <input className="input" list="measure-units" value={newIngredient.unit} onChange={(e) => setNewIngredient({ ...newIngredient, unit: e.target.value })} />
          </Field>
          <div>
            <button type="button" className="btn" disabled={!newIngredient.name.trim() || createIngredient.isPending} onClick={addIngredient}>
              {t('medications.createIngredient')}
            </button>
          </div>
        </div>
        <datalist id="measure-units">
          {UNITS.map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>
        <ErrorText error={createIngredient.error} />
      </div>
      <ErrorText error={save.error} />
      <button type="submit" className="btn btn-primary btn-block" disabled={save.isPending}>
        {t('common.save')}
      </button>
    </form>
  )
}

/** Adds a limit to an ingredient (LI-1, LI-2). All values are the user's own (LI-3). */
function LimitForm({ ingredient }: { ingredient: IngredientDto }) {
  const { t } = useTranslation()
  const [kind, setKind] = useState<LimitKind>('days')
  const [max, setMax] = useState('')
  const [length, setLength] = useState('1')
  const [unit, setUnit] = useState<WindowUnit>('month')
  const create = useApiMutation(endpoints.createLimit)

  function submit(event: FormEvent) {
    event.preventDefault()
    const windowMinutes = Math.round((parseDecimal(length) ?? 0) * WINDOW_MINUTES[unit])
    create.mutate(
      { ingredientId: ingredient.id, kind, maxValue: kind === 'min_interval' ? 0 : (parseDecimal(max) ?? 0), windowMinutes },
      { onSuccess: () => setMax('') },
    )
  }

  return (
    <form className="limit-form" onSubmit={submit}>
      <select className="input" aria-label={t('limits.kind')} value={kind} onChange={(e) => {
        const next = e.target.value as LimitKind
        setKind(next)
        if (next === 'min_interval') {
          setUnit('hours')
          setLength('2')
        }
      }}>
        {KINDS.map((k) => (
          <option key={k} value={k}>
            {t(`limits.kinds.${k}`, { unit: ingredient.measureUnit })}
          </option>
        ))}
      </select>
      {kind !== 'min_interval' && <DecimalInput aria-label={t('limits.max')} placeholder={t('limits.max')} value={max} onChange={setMax} required />}
      <span className="muted">{kind === 'min_interval' ? t('limits.atLeast') : t('limits.per')}</span>
      <DecimalInput aria-label={t('limits.windowLength')} value={length} onChange={setLength} required />
      <select className="input" aria-label={t('limits.windowUnit')} value={unit} onChange={(e) => setUnit(e.target.value as WindowUnit)}>
        {(kind === 'min_interval' ? (['hours', 'days'] as WindowUnit[]) : (['hours', 'days', 'weeks', 'month'] as WindowUnit[])).map((u) => (
          <option key={u} value={u}>
            {t(`limits.windowUnits.${u}`)}
          </option>
        ))}
      </select>
      <button type="submit" className="btn btn-small" disabled={create.isPending}>
        {t('limits.add')}
      </button>
      <ErrorText error={create.error} />
    </form>
  )
}

function IngredientCard({ ingredient, medications }: { ingredient: IngredientDto; medications: MedicationDto[] }) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(ingredient.name)
  const [unit, setUnit] = useState(ingredient.measureUnit)
  const update = useApiMutation(() => endpoints.updateIngredient(ingredient.id, { name, measureUnit: unit }))
  const remove = useApiMutation(() => endpoints.deleteIngredient(ingredient.id))
  const archive = useApiMutation(() => endpoints.archiveIngredient(ingredient.id, !ingredient.archived))
  const deleteLimit = useApiMutation(endpoints.deleteLimit)
  const usedIn = medications.filter((m) => ingredient.medicationIds.includes(m.id))

  return (
    <Card
      title={
        <>
          {ingredient.name} <span className="muted small">{ingredient.measureUnit}</span> {ingredient.archived && <Badge>{t('common.archived')}</Badge>}
        </>
      }
      actions={
        <button type="button" className="btn btn-ghost btn-small" onClick={() => setEditing(!editing)}>
          {editing ? t('common.cancel') : t('common.edit')}
        </button>
      }
    >
      {editing && (
        <form className="inline-form" onSubmit={(e) => {
          e.preventDefault()
          update.mutate(undefined, { onSuccess: () => setEditing(false) })
        }}>
          <Field label={t('medications.name')}>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <Field label={t('medications.measureUnit')}>
            <input className="input" list="measure-units" value={unit} onChange={(e) => setUnit(e.target.value)} required />
          </Field>
          <div className="row-actions">
            <button type="submit" className="btn btn-primary btn-small">
              {t('common.save')}
            </button>
            {usedIn.length === 0 ? (
              <ConfirmButton className="btn btn-small" onConfirm={() => remove.mutate(undefined)}>
                {t('common.delete')}
              </ConfirmButton>
            ) : (
              <button type="button" className="btn btn-small" onClick={() => archive.mutate(undefined)}>
                {ingredient.archived ? t('common.unarchive') : t('common.archive')}
              </button>
            )}
          </div>
          <ErrorText error={update.error ?? remove.error ?? archive.error} />
        </form>
      )}
      <p className="muted small">{usedIn.length ? t('ingredients.usedIn', { names: usedIn.map((m) => m.name).join(', ') }) : t('ingredients.unused')}</p>
      {ingredient.limits.length > 0 ? (
        <ul className="limit-list">
          {ingredient.limits.map((status) => (
            <li key={status.limit.id} className={`limit-${status.state}`}>
              <span>{limitSentence(status, t)}</span>
              <ConfirmButton className="btn btn-ghost btn-small" onConfirm={() => deleteLimit.mutate(status.limit.id)}>
                {t('common.remove')}
              </ConfirmButton>
            </li>
          ))}
        </ul>
      ) : (
        <p className="field-hint">{t('ingredients.noLimits')}</p>
      )}
      <LimitForm ingredient={ingredient} />
    </Card>
  )
}

/** Medications and remedies, and their active ingredients with the user's limits (ME-*, IN-*, LI-*). */
export function MedicationsPage() {
  const { t } = useTranslation()
  const medications = useMedications(true)
  const ingredients = useIngredients(true)
  const [editing, setEditing] = useState<MedicationDto | 'new' | null>(null)
  const archive = useApiMutation(({ id, archived }: { id: number; archived: boolean }) => endpoints.archiveMedication(id, archived))
  const remove = useApiMutation(endpoints.deleteMedication)

  return (
    <div className="page">
      <PageHeader
        title={t('medications.title')}
        subtitle={t('medications.subtitle')}
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
            {t('medications.new')}
          </button>
        }
      />
      <QueryView query={medications}>
        {(list) =>
          list.length === 0 ? (
            <Card>
              <Empty>{t('medications.empty')}</Empty>
            </Card>
          ) : (
            <Card>
              <ul className="medication-list">
                {list.map((m) => (
                  <li key={m.id} className={m.archived ? 'archived' : ''}>
                    <span className="medication-main">
                      <b>{m.name}</b>
                      <small>
                        {m.isRemedy
                          ? t('medications.remedy')
                          : m.ingredients
                              .map((i) => (i.amountPerUnit !== null ? `${i.ingredientName} ${formatNumber(i.amountPerUnit)} ${i.measureUnit}` : `${i.ingredientName} (${t('medications.amountUnknown')})`))
                              .join(' + ')}
                        {' · '}
                        {t('medications.per', { unit: m.doseUnit })}
                        {' · '}
                        {t('medications.doses', { count: m.doseCount })}
                      </small>
                    </span>
                    {m.archived && <Badge>{t('common.archived')}</Badge>}
                    <span className="row-actions">
                      <button type="button" className="btn btn-small" onClick={() => setEditing(m)}>
                        {t('common.edit')}
                      </button>
                      {m.doseCount === 0 ? (
                        <ConfirmButton className="btn btn-ghost btn-small" onConfirm={() => remove.mutate(m.id)}>
                          {t('common.delete')}
                        </ConfirmButton>
                      ) : (
                        <button type="button" className="btn btn-ghost btn-small" onClick={() => archive.mutate({ id: m.id, archived: !m.archived })}>
                          {m.archived ? t('common.unarchive') : t('common.archive')}
                        </button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              <ErrorText error={archive.error ?? remove.error} />
            </Card>
          )
        }
      </QueryView>
      <h2>{t('ingredients.title')}</h2>
      <p className="muted">{t('ingredients.subtitle')}</p>
      <QueryView query={ingredients}>
        {(list) =>
          list.length === 0 ? (
            <Card>
              <Empty>{t('ingredients.empty')}</Empty>
            </Card>
          ) : (
            <div className="two-col">
              {list.map((ingredient) => (
                <IngredientCard key={ingredient.id} ingredient={ingredient} medications={medications.data ?? []} />
              ))}
            </div>
          )
        }
      </QueryView>
      {editing && (
        <Sheet title={editing === 'new' ? t('medications.new') : editing.name} onClose={() => setEditing(null)}>
          <MedicationEditor medication={editing === 'new' ? undefined : editing} ingredients={ingredients.data ?? []} onDone={() => setEditing(null)} />
        </Sheet>
      )}
    </div>
  )
}
