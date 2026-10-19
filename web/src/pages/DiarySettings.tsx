import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import * as endpoints from '../api/endpoints'
import { useApiMutation, useMedications } from '../api/queries'
import type { SettingsDto, SettingsInput } from '../api/types.gen'
import { Card, ErrorText, Field } from '../components/ui'
import { currentLocale } from '../lib/format'

function weekdayName(day: number): string {
  // 5 January 2026 is a Monday.
  return new Intl.DateTimeFormat(currentLocale(), { weekday: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 0, 4 + day)))
}

/** S-1 … S-5: day cutoff, follow-up delay, usual medication, dim during attacks, time zone, working week. */
export function DiarySettings({ settings }: { settings: SettingsDto }) {
  const { t } = useTranslation()
  const medications = useMedications()
  const { locale: _locale, calendarFeed: _feed, ...initial } = settings
  const [form, setForm] = useState<Omit<SettingsDto, 'locale' | 'calendarFeed'>>(initial)
  const save = useApiMutation(endpoints.updateSettings)
  const set = (patch: Partial<SettingsInput>) => {
    save.reset()
    setForm({ ...form, ...patch })
  }
  const zones = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : []

  function submit(event: FormEvent) {
    event.preventDefault()
    save.mutate(form)
  }

  return (
    <Card title={t('settings.diary')}>
      <form className="stack" onSubmit={submit}>
        <div className="form-row">
          <Field label={t('settings.dayCutoff')} hint={t('settings.dayCutoffHint')}>
            <input className="input" type="time" value={form.dayCutoff} onChange={(e) => set({ dayCutoff: e.target.value })} required />
          </Field>
          <Field label={t('settings.followUp')} hint={t('settings.followUpHint')}>
            <input className="input" type="number" min={1} max={1440} value={form.followUpMinutes} onChange={(e) => set({ followUpMinutes: Number(e.target.value) })} required />
          </Field>
        </div>
        <Field label={t('settings.usual')} hint={t('settings.usualHint')}>
          <select className="input" value={form.usualMedicationId ?? ''} onChange={(e) => set({ usualMedicationId: e.target.value ? Number(e.target.value) : null })}>
            <option value="">{t('settings.mostUsed')}</option>
            {medications.data?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </Field>
        <label className="checkbox">
          <input type="checkbox" checked={form.dimDuringAttacks} onChange={(e) => set({ dimDuringAttacks: e.target.checked })} /> {t('settings.dim')}
        </label>
        <Field label={t('settings.timeZone')}>
          <select className="input" value={form.timeZone ?? ''} onChange={(e) => set({ timeZone: e.target.value || null })}>
            {!form.timeZone && <option value="">—</option>}
            {(zones.includes(form.timeZone ?? '') || !form.timeZone ? zones : [form.timeZone!, ...zones]).map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </select>
        </Field>
        <div className="field">
          <span className="field-label">{t('settings.workdays')}</span>
          <div className="chips">
            {[1, 2, 3, 4, 5, 6, 7].map((day) => {
              const on = form.workdays.includes(day)
              return (
                <button key={day} type="button" className={`chip ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => set({ workdays: on ? form.workdays.filter((d) => d !== day) : [...form.workdays, day].sort() })}>
                  {weekdayName(day)}
                </button>
              )
            })}
          </div>
          <span className="field-hint">{t('settings.workHint')}</span>
        </div>
        <div className="form-row">
          <Field label={t('settings.workStart')}>
            <input className="input" type="time" value={form.workStart} onChange={(e) => set({ workStart: e.target.value })} required />
          </Field>
          <Field label={t('settings.workEnd')}>
            <input className="input" type="time" value={form.workEnd} onChange={(e) => set({ workEnd: e.target.value })} required />
          </Field>
        </div>
        <ErrorText error={save.error} />
        {save.isSuccess && <p className="saved">✓ {t('common.saved')}</p>}
        <div>
          <button type="submit" className="btn btn-primary" disabled={save.isPending}>
            {t('common.save')}
          </button>
        </div>
      </form>
    </Card>
  )
}
