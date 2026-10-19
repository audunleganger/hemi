import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as endpoints from '../api/endpoints'
import { useApiMutation } from '../api/queries'
import type { AttackDto, DiscardResult } from '../api/types.gen'
import { ErrorText } from '../components/ui'
import { formatQuantity } from '../lib/format'
import { clock, formatMomentDay } from '../lib/time'

/**
 * Discard the ongoing attack (AT-16): undoes the start. Says what goes (the attack, or only its recurrence),
 * lists the doses logged in it, and deletes them too unless unticked.
 */
export function DiscardForm({ attack, onDone }: { attack: AttackDto; onDone: (result: DiscardResult) => void }) {
  const { t } = useTranslation()
  const [deleteDoses, setDeleteDoses] = useState(true)
  const discard = useApiMutation(() => endpoints.discardAttack(attack.summary.id, { deleteDoses }))
  const episode = attack.episodes[attack.episodes.length - 1]
  const recurrence = attack.episodes.length > 1
  // As on the server: a recurrence takes what was logged from its start; a new attack takes everything.
  const doses = recurrence ? attack.doses.filter((d) => d.at.at >= episode.start.at) : attack.doses
  return (
    <div className="stack">
      <p>
        {recurrence
          ? t('discard.recurrence', { time: clock(episode.start), day: formatMomentDay(attack.summary.start) })
          : t('discard.attack', { time: clock(episode.start) })}
      </p>
      {doses.length > 0 && (
        <>
          <ul className="discard-doses">
            {doses.map((dose) => (
              <li key={dose.id}>
                <span className="tnum">{clock(dose.at)}</span> {dose.medicationName} · {formatQuantity(dose.quantity)} {dose.doseUnit}
              </li>
            ))}
          </ul>
          <label className="checkbox">
            <input type="checkbox" checked={deleteDoses} onChange={(e) => setDeleteDoses(e.target.checked)} />{' '}
            {t('discard.deleteDoses', { count: doses.length })}
          </label>
          {!deleteDoses && <p className="field-hint">{t('discard.keepHint', { count: doses.length })}</p>}
        </>
      )}
      <ErrorText error={discard.error} />
      <button type="button" className="btn btn-danger btn-block" disabled={discard.isPending} onClick={() => discard.mutate(undefined, { onSuccess: onDone })}>
        {recurrence ? t('discard.confirmRecurrence') : t('discard.confirm')}
      </button>
    </div>
  )
}
