import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAttacks, useSettings } from '../api/queries'
import type { AttackStatus } from '../api/types.gen'
import { Card, PageHeader, QueryView } from '../components/ui'
import { clockMinutes } from '../lib/time'
import { STATUSES } from '../record/AfterwardsForm'
import { RecentAttacks } from './home/RecentAttacks'

/** All attacks, newest first, with filters (V-4). */
export function AttacksPage() {
  const { t } = useTranslation()
  const settings = useSettings()
  const [statuses, setStatuses] = useState<AttackStatus[]>(STATUSES)
  const [peak, setPeak] = useState<number | undefined>(undefined)
  const attacks = useAttacks({ status: statuses, peak })
  const toggle = (status: AttackStatus) => setStatuses(statuses.includes(status) ? statuses.filter((s) => s !== status) : [...statuses, status])

  return (
    <div className="page">
      <PageHeader title={t('attacks.title')} />
      <Card>
        <div className="filters">
          <div className="chips" role="group" aria-label={t('attack.status')}>
            {STATUSES.map((status) => (
              <button key={status} type="button" className={`chip ${statuses.includes(status) ? 'on' : ''}`} aria-pressed={statuses.includes(status)} onClick={() => toggle(status)}>
                {t(`status.${status}`)}
              </button>
            ))}
          </div>
          <select className="input input-inline" aria-label={t('attacks.peakFilter')} value={peak ?? ''} onChange={(e) => setPeak(e.target.value ? Number(e.target.value) : undefined)}>
            <option value="">{t('attacks.anyPeak')}</option>
            {[1, 2, 3].map((s) => (
              <option key={s} value={s}>
                {t('attacks.peak', { severity: s })}
              </option>
            ))}
          </select>
        </div>
        <QueryView query={attacks}>
          {(list) => <RecentAttacks attacks={list} limit={1000} cutoffMinutes={settings.data ? clockMinutes(settings.data.dayCutoff) : 240} />}
        </QueryView>
      </Card>
    </div>
  )
}
