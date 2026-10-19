import { useTranslation } from 'react-i18next'

/** 0–3 as buttons, with their names (glossary "Severity"); the number is always shown (NF-3). */
export function SeverityButtons({
  value,
  onChange,
  min = 0,
  large = false,
  label,
}: {
  value: number | null
  onChange: (severity: number) => void
  min?: number
  large?: boolean
  label?: string
}) {
  const { t } = useTranslation()
  const levels = [0, 1, 2, 3].filter((s) => s >= min)
  return (
    <div className={large ? 'sev-buttons large' : 'sev-buttons'} role="group" aria-label={label ?? t('severity.label')}>
      {levels.map((s) => (
        <div key={s} className="sev-option">
          <button type="button" className={`sev-button sev-${s} ${value === s ? 'on' : ''}`} aria-pressed={value === s} onClick={() => onChange(s)} aria-label={`${s} ${t(`severity.s${s}` as 'severity.s0')}`}>
            {s}
          </button>
          <span>{t(`severity.s${s}` as 'severity.s0')}</span>
        </div>
      ))}
    </div>
  )
}
