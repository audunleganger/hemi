import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAttacks, useSigns, useSymptoms } from '../api/queries'
import type { AttackStatus, AttackSummary, SymptomDto, WarningSignDto } from '../api/types.gen'
import { Card, ErrorText, Loading, PageHeader } from '../components/ui'
import { STATUSES } from '../record/AttackFields'
import { useRecord } from '../record/RecordContext'
import { clock, formatDuration, formatMomentDay } from '../lib/time'
import { AttackRow } from './home/RecentAttacks'
import { symptomNames } from '../lib/symptoms'

type Kind = 'attacks' | 'signs'
const KINDS: Kind[] = ['attacks', 'signs']

/** Chips where at least one stays on: none would mean no filter (V-4). */
function Toggles<T extends string>({ all, on, label, last, name, onChange }: { all: T[]; on: T[]; label: string; last: string; name: (value: T) => string; onChange: (on: T[]) => void }) {
  return (
    <div className="chips" role="group" aria-label={label}>
      {all.map((value) => {
        const isLast = on.length === 1 && on[0] === value
        return (
          <button
            key={value}
            type="button"
            className={`chip ${on.includes(value) ? 'on' : ''}`}
            aria-pressed={on.includes(value)}
            disabled={isLast}
            title={isLast ? last : undefined}
            onClick={() => onChange(on.includes(value) ? on.filter((v) => v !== value) : [...on, value])}
          >
            {name(value)}
          </button>
        )
      })}
    </div>
  )
}

function SignRow({ sign, symptoms }: { sign: WarningSignDto; symptoms: SymptomDto[] }) {
  const { t } = useTranslation()
  const record = useRecord()
  const units = { d: t('units.d'), h: t('units.h'), min: t('units.min') }
  const names = symptomNames(sign.symptomIds, symptoms)
  const facts = [
    clock(sign.at),
    names.length > 0 ? names.join(', ') : t('signs.noSymptoms'),
    sign.attackStart && sign.attackStart.at > sign.at.at ? t('signs.beforeAttack', { time: formatDuration(sign.attackStart.at - sign.at.at, units) }) : null,
  ].filter(Boolean)
  return (
    <li>
      <button type="button" className="attack-row sign-row" onClick={() => record.open({ kind: 'sign', sign })}>
        <i className="sign-icon" aria-hidden="true" />
        <span>
          <b>
            {formatMomentDay(sign.at)} · {t('diary.signs')}
          </b>
          <small>{facts.join(' · ')}</small>
          {sign.note && <small>{sign.note}</small>}
        </span>
      </button>
    </li>
  )
}

/**
 * The diary (V-4): attacks and warning signs (WS-1), newest first. The kind and status filters each keep at
 * least one option on; status and peak filter attacks only.
 */
export function DiaryPage() {
  const { t } = useTranslation()
  const [kinds, setKinds] = useState<Kind[]>(KINDS)
  const [statuses, setStatuses] = useState<AttackStatus[]>(STATUSES)
  const [peak, setPeak] = useState<number | undefined>(undefined)
  const showAttacks = kinds.includes('attacks')
  const showSigns = kinds.includes('signs')
  const attacks = useAttacks({ status: statuses, peak })
  const signs = useSigns()
  const symptoms = useSymptoms(true)

  const loading = (showAttacks && attacks.isPending) || (showSigns && signs.isPending)
  const rows: ({ kind: 'attack'; at: number; attack: AttackSummary } | { kind: 'sign'; at: number; sign: WarningSignDto })[] = [
    ...(showAttacks ? (attacks.data ?? []).map((attack) => ({ kind: 'attack' as const, at: attack.start.at, attack })) : []),
    ...(showSigns ? (signs.data ?? []).map((sign) => ({ kind: 'sign' as const, at: sign.at.at, sign })) : []),
  ].sort((a, b) => b.at - a.at)

  return (
    <div className="page">
      <PageHeader title={t('diary.title')} />
      <Card>
        <div className="filters">
          <Toggles all={KINDS} on={kinds} label={t('diary.kinds')} last={t('diary.lastKind')} name={(kind) => t(`diary.${kind}`)} onChange={setKinds} />
          {showAttacks && (
            <>
              <Toggles all={STATUSES} on={statuses} label={t('attack.status')} last={t('attacks.lastStatus')} name={(status) => t(`status.${status}`)} onChange={setStatuses} />
              <select className="input input-inline" aria-label={t('attacks.peakFilter')} value={peak ?? ''} onChange={(e) => setPeak(e.target.value ? Number(e.target.value) : undefined)}>
                <option value="">{t('attacks.anyPeak')}</option>
                {[1, 2, 3].map((s) => (
                  <option key={s} value={s}>
                    {t('attacks.peak', { severity: s })}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
        <ErrorText error={attacks.error ?? signs.error} />
        {loading ? (
          <Loading />
        ) : rows.length === 0 ? (
          <p className="empty">{t('diary.empty')}</p>
        ) : (
          <ul className="attack-rows">
            {rows.map((row) =>
              row.kind === 'attack' ? (
                <AttackRow key={`a-${row.attack.id}`} attack={row.attack} />
              ) : (
                <SignRow key={`s-${row.sign.id}`} sign={row.sign} symptoms={symptoms.data ?? []} />
              ),
            )}
          </ul>
        )}
      </Card>
    </div>
  )
}
