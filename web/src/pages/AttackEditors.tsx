import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import * as endpoints from '../api/endpoints'
import { useApiMutation } from '../api/queries'
import type { AttackDto, EpisodeDto, Moment, ReadingDto } from '../api/types.gen'
import { severityColor } from '../components/HeadIcon'
import { SeverityButtons } from '../components/SeverityButtons'
import { useToast } from '../components/Toast'
import { ConfirmButton, ErrorText, Field } from '../components/ui'
import { clock, formatMomentDay, localDate, momentFromLocal, nowMoment, toInputs } from '../lib/time'

/**
 * A date and time input pair for a moment. Time inputs are minute-rounded, so an untouched pair gives back
 * the moment it started from rather than a rounded one.
 */
export function useMomentInputs(initial: Moment | null) {
  const start = initial ? toInputs(initial) : { date: '', time: '' }
  const [date, setDate] = useState(start.date)
  const [time, setTime] = useState(start.time)
  const changed = date !== start.date || time !== start.time
  return {
    date,
    time,
    setDate,
    setTime,
    /** Null when the time is empty. */
    moment: (): Moment | null => (!changed ? initial : time && date ? momentFromLocal(date, time) : null),
  }
}

export function MomentFields({ labels, inputs, required = false, hint }: { labels: [string, string]; inputs: ReturnType<typeof useMomentInputs>; required?: boolean; hint?: string }) {
  return (
    <div>
      <div className="form-row">
        <Field label={labels[0]}>
          <input className="input" type="date" value={inputs.date} onChange={(e) => inputs.setDate(e.target.value)} required={required} />
        </Field>
        <Field label={labels[1]}>
          <input className="input" type="time" value={inputs.time} onChange={(e) => inputs.setTime(e.target.value)} required={required} />
        </Field>
      </div>
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  )
}

/** "Mon 19 Oct 14:00", with the day left out when it's the same as [sameDayAs]. */
export function when(m: Moment, sameDayAs?: Moment): string {
  return sameDayAs && localDate(m) === localDate(sameDayAs) ? clock(m) : `${formatMomentDay(m)} ${clock(m)}`
}

/** The attack's episodes (AT-7, AT-12): start, end and "woke up with it" are editable; a recurrence can become its own attack. */
export function EpisodesEditor({ attack }: { attack: AttackDto }) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState<number | null>(null)
  const { episodes } = attack
  return (
    <ul className="edit-list">
      {episodes.map((episode, i) => (
        <li key={episode.id}>
          {editing === episode.id ? (
            <EpisodeForm key={attack.updatedAt} attack={attack} episode={episode} index={i} onDone={() => setEditing(null)} />
          ) : (
            <div className="edit-row">
              <span>
                <b>{i === 0 ? t('episodes.first') : t('episodes.recurrence', { count: i })}</b>
                <small>
                  {[
                    `${when(episode.start)}–${episode.end ? when(episode.end, episode.start) : attack.summary.ongoing && i === episodes.length - 1 ? t('chart.now') : '?'}`,
                    episode.startUnknown ? t('day.wokeUp') : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </small>
              </span>
              <button type="button" className="btn btn-ghost btn-small" aria-label={t('episodes.edit', { name: i === 0 ? t('episodes.first') : t('episodes.recurrence', { count: i }) })} onClick={() => setEditing(episode.id)}>
                {t('common.edit')}
              </button>
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}

function EpisodeForm({ attack, episode, index, onDone }: { attack: AttackDto; episode: EpisodeDto; index: number; onDone: () => void }) {
  const { t } = useTranslation()
  const toast = useToast()
  const navigate = useNavigate()
  const id = attack.summary.id
  const start = useMomentInputs(episode.start)
  const end = useMomentInputs(episode.end)
  const [wokeUp, setWokeUp] = useState(episode.startUnknown)
  const save = useApiMutation(() => endpoints.updateEpisode(id, episode.id, { start: start.moment()!, startUnknown: wokeUp, end: end.moment() }))
  const remove = useApiMutation(() => endpoints.deleteEpisode(id, episode.id))
  const split = useApiMutation(() => endpoints.splitEpisode(id, episode.id))
  const last = index === attack.episodes.length - 1
  const endHint = last && !attack.summary.loggedAfterwards ? t('episodes.endEmptyOngoing') : t('episodes.endEmpty')

  function submit(event: FormEvent) {
    event.preventDefault()
    save.mutate(undefined, { onSuccess: onDone })
  }

  return (
    <form className="stack edit-form" onSubmit={submit}>
      <b>{index === 0 ? t('episodes.first') : t('episodes.recurrence', { count: index })}</b>
      <MomentFields labels={[t('episodes.startDate'), t('episodes.startTime')]} inputs={start} required />
      <label className="checkbox">
        <input type="checkbox" checked={wokeUp} onChange={(e) => setWokeUp(e.target.checked)} /> {t('start.wokeUp')}
      </label>
      <MomentFields labels={[t('episodes.endDate'), t('episodes.endTime')]} inputs={end} hint={endHint} />
      <ErrorText error={save.error ?? remove.error ?? split.error} />
      <div className="row-actions">
        <button type="submit" className="btn btn-primary" disabled={save.isPending}>
          {t('common.save')}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onDone}>
          {t('common.cancel')}
        </button>
        {index > 0 && (
          <button
            type="button"
            className="btn btn-ghost"
            disabled={split.isPending}
            onClick={() =>
              split.mutate(undefined, {
                onSuccess: (created) => {
                  onDone()
                  toast.show(t('episodes.splitDone'), { label: t('episodes.openNew'), run: () => void navigate(`/attacks/${created.summary.id}`) })
                },
              })
            }
          >
            {t('episodes.split')}
          </button>
        )}
        {attack.episodes.length > 1 && (
          <ConfirmButton className="btn btn-ghost" disabled={remove.isPending} onConfirm={() => remove.mutate(undefined, { onSuccess: onDone })}>
            {t('episodes.delete')}
          </ConfirmButton>
        )}
      </div>
      {index > 0 && <p className="field-hint">{t('episodes.splitHint')}</p>}
    </form>
  )
}

/** The attack's readings (AT-3, AT-12): add one at any time, change its time or severity, or delete it. */
export function ReadingsEditor({ attack }: { attack: AttackDto }) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState<number | 'new' | null>(null)
  return (
    <div className="stack">
      {attack.readings.length === 0 && editing !== 'new' && <p className="empty">{t('readings.none')}</p>}
      <ul className="edit-list">
        {attack.readings.map((reading) => (
          <li key={reading.id}>
            {editing === reading.id ? (
              <ReadingForm key={attack.updatedAt} attack={attack} reading={reading} onDone={() => setEditing(null)} />
            ) : (
              <div className="edit-row">
                <span className="reading-line">
                  <span className="tl-marker reading" style={{ background: reading.severity ? severityColor(reading.severity) : 'var(--surface)' }} />
                  <span>
                    <span className="tnum">{when(reading.at, attack.summary.start)}</span> · {t('day.reading', { name: t(`severity.s${reading.severity}` as 'severity.s0'), severity: reading.severity })}
                    {reading.estimated && <small>{t('day.estimated')}</small>}
                  </span>
                </span>
                <button
                  type="button"
                  className="btn btn-ghost btn-small"
                  aria-label={t('readings.edit', { time: clock(reading.at), severity: reading.severity })}
                  onClick={() => setEditing(reading.id)}
                >
                  {t('common.edit')}
                </button>
              </div>
            )}
          </li>
        ))}
        {editing === 'new' && (
          <li>
            <ReadingForm attack={attack} reading={null} onDone={() => setEditing(null)} />
          </li>
        )}
      </ul>
      {editing !== 'new' && (
        <div>
          <button type="button" className="btn btn-small" onClick={() => setEditing('new')}>
            {t('readings.add')}
          </button>
        </div>
      )}
    </div>
  )
}

/** Edits a reading, or adds one when [reading] is null (time defaults to now). */
function ReadingForm({ attack, reading, onDone }: { attack: AttackDto; reading: ReadingDto | null; onDone: () => void }) {
  const { t } = useTranslation()
  const id = attack.summary.id
  const at = useMomentInputs(reading?.at ?? nowMoment())
  const [severity, setSeverity] = useState<number | null>(reading?.severity ?? null)
  const save = useApiMutation(() =>
    reading ? endpoints.updateReading(id, reading.id, { at: at.moment(), severity: severity! }) : endpoints.addReading(id, { at: at.moment(), severity: severity! }),
  )
  const remove = useApiMutation(() => endpoints.deleteReading(id, reading!.id))

  function submit(event: FormEvent) {
    event.preventDefault()
    save.mutate(undefined, { onSuccess: onDone })
  }

  return (
    <form className="stack edit-form" onSubmit={submit}>
      <MomentFields labels={[t('dose.date'), t('dose.time')]} inputs={at} required />
      <SeverityButtons value={severity} onChange={setSeverity} />
      {reading?.estimated && <p className="field-hint">{t('readings.estimatedHint')}</p>}
      <ErrorText error={save.error ?? remove.error} />
      <div className="row-actions">
        <button type="submit" className="btn btn-primary" disabled={severity === null || save.isPending}>
          {t('common.save')}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onDone}>
          {t('common.cancel')}
        </button>
        {reading && (
          <ConfirmButton className="btn btn-ghost" disabled={remove.isPending} onConfirm={() => remove.mutate(undefined, { onSuccess: onDone })}>
            {t('readings.delete')}
          </ConfirmButton>
        )}
      </div>
    </form>
  )
}
