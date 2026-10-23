import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import type { AttackSummary } from '../../api/types.gen'
import { HeadIcon } from '../../components/HeadIcon'
import { formatDuration, formatMomentDay } from '../../lib/time'

/** One attack with its pain-side head (V-4, DS-7); it opens its page (V-5). */
export function AttackRow({ attack }: { attack: AttackSummary }) {
  const { t } = useTranslation()
  const units = { d: t('units.d'), h: t('units.h'), min: t('units.min') }
  const facts = [
    attack.ongoing ? t('attacks.ongoing') : attack.durationMillis !== null ? formatDuration(attack.durationMillis, units) : null,
    attack.episodeCount > 1 ? t('attacks.recurrences', { count: attack.episodeCount - 1 }) : null,
    attack.status !== 'migraine' ? t(`status.${attack.status}`) : null,
    attack.peak !== null ? t('attacks.peak', { severity: attack.peak }) : t('attacks.peakUnknown'),
  ].filter(Boolean)
  return (
    <li>
      <Link to={`/attacks/${attack.id}`} className="attack-row">
        <HeadIcon side={attack.painSide} severity={attack.peak} />
        <span>
          <b>{formatMomentDay(attack.start)}</b>
          <small>{facts.join(' · ')}</small>
        </span>
      </Link>
    </li>
  )
}

/** The last few attacks (V-4). */
export function RecentAttacks({ attacks, limit = 4 }: { attacks: AttackSummary[] | undefined; limit?: number }) {
  const { t } = useTranslation()
  if (!attacks) return null
  if (attacks.length === 0) return <p className="empty">{t('home.noAttacks')}</p>
  return (
    <ul className="attack-rows">
      {attacks.slice(0, limit).map((attack) => (
        <AttackRow key={attack.id} attack={attack} />
      ))}
    </ul>
  )
}
