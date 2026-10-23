import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import * as endpoints from '../api/endpoints'
import { useApiMutation, useHome } from '../api/queries'
import type { AttackDto, Moment, PendingRating, WarningSignDto } from '../api/types.gen'
import { Sheet } from '../components/Sheet'
import { SeverityButtons } from '../components/SeverityButtons'
import { useToast } from '../components/Toast'
import { ErrorText } from '../components/ui'
import { formatMomentDay } from '../lib/time'
import { AfterwardsForm } from './AfterwardsForm'
import { DiscardForm } from './DiscardForm'
import { DoseForm } from './DoseForm'
import { EndForm } from './EndForm'
import { RatingPrompt } from './RatingPrompt'
import { SignForm } from './SignForm'
import { StartForm } from './StartForm'
import { StartWithForm } from './StartWithForm'
import { useStartAttack } from './useStartAttack'

type Open =
  | { kind: 'menu' }
  | { kind: 'start' }
  | { kind: 'startWith'; medicationId?: number }
  | { kind: 'dose'; medicationId?: number }
  | { kind: 'afterwards'; start?: Moment }
  | { kind: 'sign'; sign?: WarningSignDto }
  | { kind: 'reading' }
  | { kind: 'rating'; pending: PendingRating }
  | { kind: 'end'; attackId: number; lastReading?: Moment }
  | { kind: 'discard'; attack: AttackDto }

interface RecordApi {
  open(what: Open): void
}

const RecordContext = createContext<RecordApi>({ open: () => {} })

// eslint-disable-next-line react/only-export-components
export const useRecord = () => useContext(RecordContext)

/** The + Record menu (DS-1, WS-1): what can be logged right now. */
function RecordMenu({ open, close }: { open: (what: Open) => void; close: () => void }) {
  const { t } = useTranslation()
  const home = useHome()
  const start = useStartAttack()
  const ongoing = home.data?.ongoing ?? null
  const usual = home.data?.usualMedication ?? null
  // Over a limit, the usual medication asks first (LI-4), like in attack mode.
  const startWithUsual = () =>
    home.data?.usualDosePreview?.over ? open({ kind: 'startWith', medicationId: usual!.id }) : start.mutate({ dose: { medicationId: usual!.id } }, { onSuccess: close })
  return (
    <div className="record-menu">
      {!ongoing && (
        <>
          <button type="button" className="record-option primary" disabled={start.isPending} onClick={() => start.mutate({}, { onSuccess: close })}>
            {t('record.start')}
            <small>{t('record.startHint')}</small>
          </button>
          {usual && (
            <button type="button" className="record-option" disabled={start.isPending} onClick={startWithUsual}>
              {t('record.startWith', { medication: usual.name })}
            </button>
          )}
          <button type="button" className="record-option" onClick={() => open({ kind: 'startWith' })}>
            {t('record.startChoose')}
          </button>
          <button type="button" className="record-option" onClick={() => open({ kind: 'start' })}>
            {t('record.startOptions')}
            <small>{t('record.startOptionsHint')}</small>
          </button>
        </>
      )}
      {ongoing && (
        <button type="button" className="record-option primary" onClick={() => open({ kind: 'reading' })}>
          {t('record.reading')}
        </button>
      )}
      <button type="button" className="record-option" onClick={() => open({ kind: 'dose' })}>
        {t('record.dose')}
      </button>
      <button type="button" className="record-option" onClick={() => open({ kind: 'sign' })}>
        {t('record.sign')}
        <small>{t('record.signHint')}</small>
      </button>
      <button type="button" className="record-option" onClick={() => open({ kind: 'afterwards' })}>
        {t('record.afterwards')}
        <small>{t('record.afterwardsHint')}</small>
      </button>
      <ErrorText error={start.error} />
    </div>
  )
}

function ReadingForm({ onDone }: { onDone: () => void }) {
  const home = useHome()
  const ongoing = home.data?.ongoing
  const add = useApiMutation((severity: number) => endpoints.addReading(ongoing!.summary.id, { severity }))
  if (!ongoing) return null
  return (
    <div className="stack">
      <SeverityButtons value={null} large onChange={(severity) => add.mutate(severity, { onSuccess: onDone })} />
      <ErrorText error={add.error} />
    </div>
  )
}

export function RecordProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const toast = useToast()
  const [current, setCurrent] = useState<Open | null>(null)
  const api = useMemo<RecordApi>(() => ({ open: setCurrent }), [])
  const close = () => setCurrent(null)

  const titles: Record<Open['kind'], string> = {
    menu: t('record.title'),
    start: t('record.startOptions'),
    startWith: t('record.startChoose'),
    dose: t('record.dose'),
    afterwards: t('record.afterwards'),
    sign: t('signs.title'),
    reading: t('attackMode.question'),
    rating: t('rating.title'),
    end: t('end.title'),
    discard: t('discard.title'),
  }

  return (
    <RecordContext.Provider value={api}>
      {children}
      {current && (
        <Sheet title={titles[current.kind]} onClose={close}>
          {current.kind === 'menu' && <RecordMenu open={setCurrent} close={close} />}
          {current.kind === 'start' && <StartForm onDone={close} />}
          {current.kind === 'startWith' && <StartWithForm medicationId={current.medicationId} onDone={close} />}
          {current.kind === 'dose' && (
            <DoseForm
              initialMedicationId={current.medicationId}
              onDone={(dose) => {
                close()
                toast.show(t('dose.saved', { medication: dose.medicationName }))
              }}
            />
          )}
          {current.kind === 'afterwards' && (
            <AfterwardsForm
              start={current.start}
              onDone={() => {
                close()
                toast.show(t('afterwards.saved'))
              }}
            />
          )}
          {current.kind === 'sign' && (
            <SignForm
              key={current.sign?.id ?? 'new'}
              sign={current.sign}
              onDone={(message) => {
                close()
                if (message) toast.show(message)
              }}
              onAfterwards={(start) => setCurrent({ kind: 'afterwards', start })}
            />
          )}
          {current.kind === 'reading' && <ReadingForm onDone={close} />}
          {current.kind === 'rating' && <RatingPrompt pending={current.pending} onDone={close} />}
          {current.kind === 'end' && <EndForm attackId={current.attackId} lastReading={current.lastReading} onDone={close} />}
          {current.kind === 'discard' && (
            <DiscardForm
              attack={current.attack}
              onDone={({ restored }) => {
                close()
                toast.show(restored ? t('discard.restored', { day: formatMomentDay(restored.summary.start) }) : t('discard.discarded'))
              }}
            />
          )}
        </Sheet>
      )}
    </RecordContext.Provider>
  )
}
