import { useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import * as endpoints from '../api/endpoints'
import { useMedications } from '../api/queries'
import type { DosePreview, MedicationDto } from '../api/types.gen'
import { ErrorText, QueryView } from '../components/ui'
import { formatNumber } from '../lib/format'
import { LimitPreview } from './LimitPreview'
import { useStartAttack } from './useStartAttack'

/** Acute medications first, then preventive ones and remedies, each by name. */
function pickerOrder(a: MedicationDto, b: MedicationDto) {
  const rank = (m: MedicationDto) => (m.kind === 'acute' && !m.isRemedy ? 0 : m.isRemedy ? 2 : 1)
  return rank(a) - rank(b) || a.name.localeCompare(b.name)
}

/**
 * "Start attack + choose medication" (AT-1): one tap on a medication starts the attack and logs its usual
 * quantity. A dose that would go over a limit shows what it does and asks first (LI-4).
 */
export function StartWithForm({ medicationId, onDone }: { medicationId?: number; onDone: () => void }) {
  const { t } = useTranslation()
  const medications = useMedications()
  const start = useStartAttack()
  // Read-only, so a plain mutation: nothing to refresh afterwards.
  const preview = useMutation({ mutationFn: (id: number) => endpoints.previewDose({ medicationId: id }) })
  const [confirm, setConfirm] = useState<{ medication: MedicationDto; preview: DosePreview } | null>(null)
  const presetDone = useRef(false)

  const begin = (medication: MedicationDto) => start.mutate({ dose: { medicationId: medication.id } }, { onSuccess: onDone })
  const choose = (medication: MedicationDto) =>
    preview.mutate(medication.id, { onSuccess: (result) => (result.over ? setConfirm({ medication, preview: result }) : begin(medication)) })

  // Opened for one medication (the usual one, over a limit): go straight to its check.
  const preset = medications.data?.find((m) => m.id === medicationId)
  useEffect(() => {
    if (!preset || presetDone.current) return
    presetDone.current = true
    preview.mutate(preset.id, { onSuccess: (result) => setConfirm({ medication: preset, preview: result }) })
  }, [preset, preview])

  return (
    <QueryView query={medications}>
      {(list) => {
        if (confirm) {
          return (
            <div className="stack">
              <p>{t('startWith.overLimit', { medication: confirm.medication.name })}</p>
              <LimitPreview preview={confirm.preview} />
              <ErrorText error={start.error} />
              <button type="button" className="btn btn-primary btn-block" disabled={start.isPending} onClick={() => begin(confirm.medication)}>
                {t('startWith.anyway', { medication: confirm.medication.name })}
              </button>
              <button type="button" className="btn btn-block" disabled={start.isPending} onClick={() => setConfirm(null)}>
                {t('startWith.other')}
              </button>
            </div>
          )
        }
        const active = list.filter((m) => !m.archived).sort(pickerOrder)
        if (active.length === 0) return <p className="muted">{t('startWith.none')}</p>
        const busy = start.isPending || preview.isPending
        return (
          <div className="record-menu">
            {active.map((m) => (
              <button key={m.id} type="button" className="record-option" disabled={busy} onClick={() => choose(m)}>
                {m.name}
                <small>
                  {formatNumber(m.defaultQuantity)} {m.defaultQuantity === 1 ? m.doseUnit : m.doseUnitPlural}
                </small>
              </button>
            ))}
            <ErrorText error={preview.error ?? start.error} />
          </div>
        )
      }}
    </QueryView>
  )
}
