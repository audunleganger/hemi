import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useAttacks, useCalendar, useDay } from '../../api/queries'
import type { CalendarDay, HomeView, SettingsDto } from '../../api/types.gen'
import { formatMonth, MonthCalendar, monthGrid, SeverityLegend, shiftMonth, YearStrip } from '../../components/Calendars'
import { DayTimeline } from '../../components/DayTimeline'
import { HeadIcon } from '../../components/HeadIcon'
import { AcuteDaysRing, LimitRing } from '../../components/LimitRing'
import { addDays, formatDate } from '../../lib/dates'
import { currentLocale } from '../../lib/format'
import { clockMinutes } from '../../lib/time'
import { Notices } from './Notices'
import { RecentAttacks } from './RecentAttacks'

function useDays(from: string, to: string) {
  const query = useCalendar(from, to)
  return new Map<string, CalendarDay>((query.data?.days ?? []).map((d) => [d.date, d]))
}

/**
 * Home is the calendar (DS-2): the month with the selected day's timeline below it, then the limits. On a PC
 * (DS-1) a year strip and stat tiles run across the top, with month · day · limits in three columns.
 */
export function CalendarHome({
  home,
  settings,
  now,
  selected,
  month,
  onSelect,
  onMonth,
}: {
  home: HomeView
  settings: SettingsDto
  now: number
  selected: string
  month: string
  onSelect: (date: string) => void
  onMonth: (month: string) => void
}) {
  const { t } = useTranslation()
  const today = home.today
  const grid = monthGrid(month)
  const monthDays = useDays(grid.from, grid.to)
  const yearDays = useDays(addDays(today, -380), today)
  const day = useDay(selected)
  const recent = useAttacks()
  const cutoff = clockMinutes(settings.dayCutoff)
  const thisMonth = today.slice(0, 7)
  const inMonth = [...yearDays.values()].filter((d) => d.date.startsWith(thisMonth))
  const monthName = new Intl.DateTimeFormat(currentLocale(), { month: 'long', timeZone: 'UTC' }).format(new Date(`${thisMonth}-01T00:00:00Z`))
  const selectedAttack = day.data?.attacks.find((a) => a.ongoing) ?? day.data?.attacks[0]

  const select = (date: string) => {
    onSelect(date)
    if (!date.startsWith(month)) onMonth(date.slice(0, 7))
  }

  return (
    <div className="calendar-home">
      <Notices home={home} />
      <section className="year-panel panel">
        <YearStrip days={yearDays} today={today} onSelect={select} />
        <div className="stat-tiles">
          <div className="stat">
            <b className="tnum">{inMonth.filter((d) => d.attack && !d.unsure).length}</b>
            <span>{t('home.migraineDays', { month: monthName })}</span>
          </div>
          <div className="stat">
            <b className="tnum">
              {home.acuteMedicationDays.count} / {home.acuteMedicationDays.windowDays}
            </b>
            <span>{t('limits.acuteDays')}</span>
          </div>
          <div className="stat">
            <b className="tnum">{inMonth.filter((d) => d.workImpact === 'missed').length}</b>
            <span>{t('home.missed', { month: monthName })}</span>
          </div>
          <div className="stat">
            <b className="tnum">{inMonth.filter((d) => d.workImpact === 'home_early').length}</b>
            <span>{t('home.homeEarly', { month: monthName })}</span>
          </div>
        </div>
      </section>
      <div className="home-columns">
        <section className="panel month-panel">
          <div className="panel-head">
            <h2>{formatMonth(month)}</h2>
            <div className="row-actions">
              <button type="button" className="btn btn-ghost btn-small btn-icon" aria-label={t('calendar.previous')} onClick={() => onMonth(shiftMonth(month, -1))}>
                ‹
              </button>
              {month !== thisMonth && (
                <button type="button" className="btn btn-ghost btn-small" onClick={() => select(today)}>
                  {t('calendar.today')}
                </button>
              )}
              <button type="button" className="btn btn-ghost btn-small btn-icon" aria-label={t('calendar.next')} onClick={() => onMonth(shiftMonth(month, 1))}>
                ›
              </button>
            </div>
          </div>
          <MonthCalendar month={month} days={monthDays} today={today} selected={selected} onSelect={select} />
          <SeverityLegend />
        </section>
        <section className="panel day-panel">
          <div className="panel-head">
            <h2>{formatDate(selected, currentLocale(), 'weekday')}</h2>
            {selectedAttack && (
              <Link to={`/attacks/${selectedAttack.id}`} className="pill pill-link">
                <HeadIcon side={selectedAttack.painSide} severity={selectedAttack.peak} size={16} />
                {selectedAttack.ongoing ? t('attacks.ongoing') : selectedAttack.peak !== null ? t('attacks.peak', { severity: selectedAttack.peak }) : t('attacks.peakUnknown')}
                {selectedAttack.painSide ? ` · ${t(`painSide.${selectedAttack.painSide}`)}` : ''}
              </Link>
            )}
          </div>
          {day.data && <DayTimeline day={day.data} cutoffMinutes={cutoff} now={now} pending={home.pendingRatings} />}
        </section>
        <section className="panel limits-panel">
          <h2 className="panel-title">{t('limits.title')}</h2>
          <div className="ring-list">
            {home.limits.map((status) => (
              <LimitRing key={status.limit.id} status={status} />
            ))}
            <AcuteDaysRing days={home.acuteMedicationDays} />
          </div>
          {home.limits.length === 0 && <p className="field-hint">{t('limits.none')}</p>}
          <h2 className="panel-title recent-title">{t('home.recent')}</h2>
          <RecentAttacks attacks={recent.data} />
        </section>
      </div>
    </div>
  )
}
