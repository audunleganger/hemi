import { useTranslation } from 'react-i18next'
import type { DosePreview, LimitEffectDto } from '../api/types.gen'
import { formatNumber } from '../lib/format'
import { formatWindow } from '../lib/limits'
import { clockOf } from '../lib/time'

function effectText(effect: LimitEffectDto, t: ReturnType<typeof useTranslation>['t']): string {
  const values = {
    ingredient: effect.ingredientName,
    before: formatNumber(effect.before),
    after: formatNumber(effect.after),
    max: formatNumber(effect.max),
    unit: effect.measureUnit,
    window: formatWindow(effect.windowMinutes, t),
  }
  if (effect.kind === 'min_interval') {
    return effect.nextAllowedAt ? t('preview.interval', { ...values, time: clockOf(effect.nextAllowedAt) }) : effect.over ? t('preview.tooClose', values) : t('preview.intervalOk', values)
  }
  if (effect.amountUnknown) return t('preview.amountUnknown', values)
  return t(`preview.${effect.kind}` as 'preview.days', values)
}

/** What the dose does to every affected limit (LI-4): "Sumatriptan: 5 → 6 of 6 days in 30 days". */
export function LimitPreview({ preview }: { preview: DosePreview | undefined }) {
  const { t } = useTranslation()
  if (!preview || preview.effects.length === 0) return null
  return (
    <ul className="limit-preview" aria-live="polite">
      {preview.effects.map((effect) => (
        <li key={effect.limitId} className={effect.over ? 'over' : ''}>
          {effect.over ? '⚠ ' : ''}
          {effectText(effect, t)}
        </li>
      ))}
    </ul>
  )
}
