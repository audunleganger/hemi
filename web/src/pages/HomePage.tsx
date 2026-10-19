import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useHome, useSettings } from '../api/queries'
import { QueryView } from '../components/ui'
import { isValidIsoDate } from '../lib/dates'
import { AttackMode } from './home/AttackMode'
import { CalendarHome } from './home/CalendarHome'

/** A clock that ticks every minute, for durations and due ratings. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])
  return now
}

/** Home (V-1): the attack screen while an attack is ongoing (DS-3), otherwise the calendar (DS-2). */
export function HomePage({ calendar = false }: { calendar?: boolean }) {
  const home = useHome()
  const settings = useSettings()
  const now = useNow()
  const [params, setParams] = useSearchParams()
  const param = params.get('day')
  const [month, setMonth] = useState<string | null>(null)

  return (
    <QueryView query={home}>
      {(data) => {
        if (data.ongoing && !calendar) return <AttackMode home={data} now={now} />
        if (!settings.data) return null
        const selected = param && isValidIsoDate(param) ? param : data.today
        return (
          <CalendarHome
            home={data}
            settings={settings.data}
            now={now}
            selected={selected}
            month={month ?? selected.slice(0, 7)}
            onSelect={(date) => setParams(date === data.today ? {} : { day: date }, { replace: true })}
            onMonth={setMonth}
          />
        )
      }}
    </QueryView>
  )
}
