import { useTranslation } from 'react-i18next'
import type { AttackStatus, Nausea, TriggerDto } from '../api/types.gen'
import { FieldGroup } from '../components/ui'

export const STATUSES: AttackStatus[] = ['migraine', 'unsure', 'not_migraine']
export const NAUSEA: Nausea[] = ['none', 'nauseous', 'vomited']

/** Status (AT-4): always one of the three. */
export function StatusField({ value, onChange }: { value: AttackStatus; onChange: (status: AttackStatus) => void }) {
  const { t } = useTranslation()
  return (
    <FieldGroup label={t('attack.status')}>
      <div className="segmented">
        {STATUSES.map((s) => (
          <button key={s} type="button" className={value === s ? 'active' : ''} aria-pressed={value === s} onClick={() => onChange(s)}>
            {t(`status.${s}`)}
          </button>
        ))}
      </div>
    </FieldGroup>
  )
}

/** Nausea (AT-8); tap the chosen one again to clear it. */
export function NauseaField({ value, onChange }: { value: Nausea | null; onChange: (nausea: Nausea | null) => void }) {
  const { t } = useTranslation()
  return (
    <FieldGroup label={t('attack.nausea')}>
      <div className="segmented">
        {NAUSEA.map((n) => (
          <button key={n} type="button" className={value === n ? 'active' : ''} aria-pressed={value === n} onClick={() => onChange(value === n ? null : n)}>
            {t(`nausea.${n}`)}
          </button>
        ))}
      </div>
    </FieldGroup>
  )
}

/** Trigger toggles (AT-10). Archived triggers are shown only while they're on (TR-3). */
export function TriggersField({ triggers, value, onChange }: { triggers: TriggerDto[]; value: number[]; onChange: (ids: number[]) => void }) {
  const { t } = useTranslation()
  const shown = triggers.filter((trigger) => !trigger.archived || value.includes(trigger.id))
  if (shown.length === 0) return null
  return (
    <FieldGroup label={t('attack.triggers')}>
      <div className="chips">
        {shown.map((trigger) => {
          const on = value.includes(trigger.id)
          return (
            <button key={trigger.id} type="button" className={`chip ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => onChange(on ? value.filter((id) => id !== trigger.id) : [...value, trigger.id])}>
              {trigger.name}
            </button>
          )
        })}
      </div>
    </FieldGroup>
  )
}
