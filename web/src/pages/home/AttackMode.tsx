import { useTranslation } from 'react-i18next'
import * as endpoints from '../../api/endpoints'
import { useApiMutation, useAttacks } from '../../api/queries'
import type { HomeView } from '../../api/types.gen'
import { AttackChart } from '../../components/AttackChart'
import { HeadIcon } from '../../components/HeadIcon'
import { AcuteDaysRing, LimitRing } from '../../components/LimitRing'
import { SeverityButtons } from '../../components/SeverityButtons'
import { useToast } from '../../components/Toast'
import { ErrorText } from '../../components/ui'
import { limitSentence } from '../../lib/limits'
import { clock, formatDuration } from '../../lib/time'
import { LimitPreview } from '../../record/LimitPreview'
import { QuickRating } from '../../record/RatingPrompt'
import { useRecord } from '../../record/RecordContext'
import { Notices } from './Notices'
import { RecentAttacks } from './RecentAttacks'

/**
 * Attack mode (DS-3): while an attack is ongoing, home is "How bad is it now?" with four large buttons, the
 * usual medication, the pending rating and a compact limits line. "It's over" is small, at the bottom.
 */
export function AttackMode({ home, now }: { home: HomeView; now: number }) {
  const { t } = useTranslation()
  const record = useRecord()
  const toast = useToast()
  const attack = home.ongoing!
  const id = attack.summary.id
  const last = attack.readings.at(-1) ?? null
  const reading = useApiMutation((severity: number) => endpoints.addReading(id, { severity }))
  const usual = home.usualMedication
  const preview = home.usualDosePreview
  const takeUsual = useApiMutation(() => endpoints.createDose({ medicationId: usual!.id, attackId: id, autoAttack: false }))
  const recent = useAttacks()
  const units = { d: t('units.d'), h: t('units.h'), min: t('units.min') }
  const pending = home.pendingRatings[0]

  function take() {
    if (preview?.over) {
      // Over a limit: the full form shows what and asks to confirm (LI-4).
      record.open({ kind: 'dose', medicationId: usual!.id })
      return
    }
    takeUsual.mutate(undefined, { onSuccess: (dose) => toast.show(t('dose.saved', { medication: dose.medicationName })) })
  }

  const controls = (
    <div className="attack-controls">
      <div className="attack-top">
        <span>{t('attackMode.since', { duration: formatDuration(now - attack.summary.start.at, units) })}</span>
        <HeadIcon side={attack.summary.painSide} severity={attack.summary.peak} size={30} />
      </div>
      <h1 className="attack-question">{t('attackMode.question')}</h1>
      <SeverityButtons large value={last?.severity ?? null} onChange={(severity) => reading.mutate(severity)} />
      <p className="attack-last">
        {last ? t('attackMode.last', { severity: last.severity, time: clock(last.at) }) : t('attackMode.noReading')} {t('attackMode.tapHint')}
      </p>
      <ErrorText error={reading.error ?? takeUsual.error} />
      {usual && (
        <button type="button" className="big-button" disabled={takeUsual.isPending} onClick={take}>
          {t('attackMode.take', { medication: usual.name })}
          <span>{preview?.over ? t('attackMode.overLimit') : t('attackMode.withinLimits')}</span>
        </button>
      )}
      {preview?.over && <LimitPreview preview={preview} />}
      <button type="button" className="mid-button" onClick={() => record.open({ kind: 'dose' })}>
        {t('attackMode.other')}
      </button>
      {pending && <QuickRating pending={pending} severity={last?.severity ?? null} onOpen={() => record.open({ kind: 'rating', pending })} />}
      <Notices home={home} ratings={false} />
      <div className="attack-limits">
        {home.limits.map((status) => (
          <span key={status.limit.id}>{limitSentence(status, t)}</span>
        ))}
        <span>{t('limits.acuteSentence', { count: home.acuteMedicationDays.count, window: home.acuteMedicationDays.windowDays })}</span>
      </div>
      <div className="attack-end">
        <button type="button" className="link-button" onClick={() => record.open({ kind: 'end', attackId: id })}>
          {t('attackMode.over')}
        </button>
        <button type="button" className="link-button" onClick={() => record.open({ kind: 'discard', attack })}>
          {t('discard.button')}
        </button>
      </div>
    </div>
  )

  return (
    <div className="attack-mode-page">
      {controls}
      <div className="attack-side">
        <section className="panel">
          <h2 className="panel-title">
            {t('attackMode.thisAttack', { time: clock(attack.summary.start) })}
            {attack.summary.wokeUp ? ` · ${t('day.wokeUp')}` : ''}
          </h2>
          <AttackChart attack={attack} now={now} />
        </section>
        <div className="attack-side-cols">
          <section className="panel">
            <h2 className="panel-title">{t('limits.title')}</h2>
            <div className="ring-list">
              {home.limits.map((status) => (
                <LimitRing key={status.limit.id} status={status} />
              ))}
              <AcuteDaysRing days={home.acuteMedicationDays} />
            </div>
          </section>
          <section className="panel">
            <h2 className="panel-title">{t('home.recent')}</h2>
            <RecentAttacks attacks={recent.data} />
          </section>
        </div>
      </div>
    </div>
  )
}
