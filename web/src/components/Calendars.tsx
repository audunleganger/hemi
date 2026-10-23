import { useTranslation } from 'react-i18next'
import type { CalendarDay } from '../api/types.gen'
import { addDays, daysBetween } from '../lib/dates'
import { currentLocale } from '../lib/format'

/** The first and last date of the month grid: whole weeks, Monday first. */
export function monthGrid(month: string): { from: string; to: string } {
  const first = `${month}-01`
  const weekday = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7
  const from = addDays(first, -weekday)
  const next = new Date(`${first}T00:00:00Z`)
  next.setUTCMonth(next.getUTCMonth() + 1)
  const last = addDays(next.toISOString().slice(0, 10), -1)
  const lastWeekday = (new Date(`${last}T00:00:00Z`).getUTCDay() + 6) % 7
  return { from, to: addDays(last, 6 - lastWeekday) }
}

export function shiftMonth(month: string, delta: number): string {
  const d = new Date(`${month}-01T00:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() + delta)
  return d.toISOString().slice(0, 7)
}

export function formatMonth(month: string): string {
  return new Intl.DateTimeFormat(currentLocale(), { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`))
}

function weekdayNames(): string[] {
  const format = new Intl.DateTimeFormat(currentLocale(), { weekday: 'narrow', timeZone: 'UTC' })
  // 5 January 2026 is a Monday.
  return Array.from({ length: 7 }, (_, i) => format.format(new Date(Date.UTC(2026, 0, 5 + i))))
}

function cellClass(day: CalendarDay | undefined, date: string, today: string, selected?: string) {
  const classes = ['cal-d']
  if (day?.attack) classes.push(day.unsure ? 'unsure' : 'filled', `sev-${day.severity ?? 'unknown'}`)
  // Warning signs (DS-9): light blue, unless a migraine fills the day; then only a mark. Unsure ones outline the blue.
  if (day?.signs) classes.push(day.attack && !day.unsure ? 'has-signs' : 'signs')
  if (date === today) classes.push('today')
  if (date > today) classes.push('future')
  if (date === selected) classes.push('selected')
  if (day?.ongoing) classes.push('ongoing')
  return classes.join(' ')
}

/** V-2, DS-9: one cell per day, filled with the day's peak severity, a dot on days with medication, light blue for warning signs. */
export function MonthCalendar({
  month,
  days,
  today,
  selected,
  onSelect,
}: {
  month: string
  days: Map<string, CalendarDay>
  today: string
  selected?: string
  onSelect: (date: string) => void
}) {
  const { t } = useTranslation()
  const { from, to } = monthGrid(month)
  const count = daysBetween(from, to) + 1
  const dates = Array.from({ length: count }, (_, i) => addDays(from, i))
  return (
    <div className="cal" role="grid" aria-label={formatMonth(month)}>
      {weekdayNames().map((name, i) => (
        <div key={i} className="cal-h" aria-hidden="true">
          {name}
        </div>
      ))}
      {dates.map((date) => {
        const day = days.get(date)
        if (!date.startsWith(month)) return <div key={date} className="cal-pad" />
        const label = [
          new Intl.DateTimeFormat(currentLocale(), { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`)),
          day?.attack ? (day.severity ? t('calendar.severity', { severity: day.severity }) : t('calendar.unknownSeverity')) : null,
          day?.unsure ? t('status.unsure') : null,
          day?.medication ? t('calendar.medication') : null,
          day?.signs ? t('calendar.signs') : null,
        ]
          .filter(Boolean)
          .join(', ')
        return (
          <button key={date} type="button" className={cellClass(day, date, today, selected)} onClick={() => onSelect(date)} aria-label={label} aria-pressed={date === selected}>
            <span className="tnum">{Number(date.slice(8))}</span>
            {day?.medication && <i className="med" />}
            {day?.signs && day.attack && !day.unsure && <i className="sign-mark" />}
          </button>
        )
      })}
    </div>
  )
}

/** DS-6, DS-9: what the calendar's fill colors mean. */
export function SeverityLegend() {
  const { t } = useTranslation()
  return (
    <ul className="cal-legend" aria-label={t('severity.label')}>
      {([1, 2, 3] as const).map((s) => (
        <li key={s}>
          <i style={{ background: `var(--sev-${s})` }} />
          {s} {t(`severity.s${s}`)}
        </li>
      ))}
      <li>
        <i style={{ background: 'var(--sev-unknown)' }} />
        {t('severity.unknown')}
      </li>
      <li>
        <i style={{ background: 'var(--sign)' }} />
        {t('diary.signs')}
      </li>
    </ul>
  )
}

/** V-3: the last year, one small square per day; tapping one opens it in the month view. */
export function YearStrip({ days, today, onSelect }: { days: Map<string, CalendarDay>; today: string; onSelect: (date: string) => void }) {
  const { t } = useTranslation()
  // Whole weeks ending with this one, Monday first, 53 columns.
  const weekday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7
  const end = addDays(today, 6 - weekday)
  const start = addDays(end, -53 * 7 + 1)
  const dates = Array.from({ length: 53 * 7 }, (_, i) => addDays(start, i))
  const monthFormat = new Intl.DateTimeFormat(currentLocale(), { month: 'short', timeZone: 'UTC' })
  return (
    <div className="year-strip">
      <div className="year-months" aria-hidden="true">
        {dates
          .filter((date, i) => i % 7 === 0 && Number(date.slice(8)) <= 7)
          .map((date) => (
            <span key={date} style={{ gridColumn: Math.floor(dates.indexOf(date) / 7) + 1 }}>
              {monthFormat.format(new Date(`${date}T00:00:00Z`))}
            </span>
          ))}
      </div>
      <div className="year" role="group" aria-label={t('calendar.year')}>
        {dates.map((date) => {
          const day = days.get(date)
          return (
            <button
              key={date}
              type="button"
              tabIndex={-1}
              className={`year-d ${cellClass(day, date, today)}`}
              title={date}
              aria-label={date}
              onClick={() => onSelect(date)}
            />
          )
        })}
      </div>
    </div>
  )
}
