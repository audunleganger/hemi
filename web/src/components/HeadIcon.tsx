import { useTranslation } from 'react-i18next'
import type { PainSide } from '../api/types.gen'

/** The fill for a severity (DS-6): the plum scale (amber in attack mode), gray when unknown (AT-15). */
export function severityColor(severity: number | null | undefined): string {
  return severity === null || severity === undefined || severity < 1 ? 'var(--sev-unknown)' : `var(--sev-${Math.min(3, severity)})`
}

const LEFT = 'M12 2.5 A8 9.5 0 0 0 12 21.5 Z'
const RIGHT = 'M12 2.5 A8 9.5 0 0 1 12 21.5 Z'

/**
 * The pain-side head (DS-7), seen from behind so the user's left is on the left. The side's half is filled
 * with the peak severity's color; outline only when no side is set.
 */
export function HeadIcon({ side, severity, size = 24, label }: { side: PainSide | null; severity: number | null; size?: number; label?: string }) {
  const { t } = useTranslation()
  const fill = severityColor(severity)
  const name = label ?? (side ? t('painSide.icon', { side: t(`painSide.${side}`) }) : t('painSide.none'))
  return (
    <svg className="head-icon" viewBox="0 0 24 26" width={size} height={Math.round((size * 26) / 24)} role="img" aria-label={name}>
      {(side === 'left' || side === 'both') && <path d={LEFT} fill={fill} />}
      {(side === 'right' || side === 'both') && <path d={RIGHT} fill={fill} />}
      <ellipse cx="12" cy="12" rx="8" ry="9.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M4.1 10.3q-2.2 1.7 0 4.2M19.9 10.3q2.2 1.7 0 4.2M9.3 21v3.5M14.7 21v3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="12" y1="3" x2="12" y2="21" stroke="currentColor" strokeWidth=".6" strokeDasharray="1.4 1.4" />
    </svg>
  )
}

/** The head as the pain-side picker (AT-9): tap a half, or both; tap again to clear. */
export function PainSidePicker({ value, onChange }: { value: PainSide | null; onChange: (side: PainSide | null) => void }) {
  const { t } = useTranslation()
  const options: PainSide[] = ['left', 'both', 'right']
  return (
    <div className="side-picker">
      <HeadIcon side={value} severity={2} size={56} />
      <div className="segmented" role="group" aria-label={t('painSide.label')}>
        {options.map((side) => (
          <button key={side} type="button" className={value === side ? 'active' : ''} aria-pressed={value === side} onClick={() => onChange(value === side ? null : side)}>
            {t(`painSide.${side}`)}
          </button>
        ))}
      </div>
    </div>
  )
}
