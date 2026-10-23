import { useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import * as endpoints from '../api/endpoints'
import { useApiMutation, useSettings } from '../api/queries'
import { useAuth } from '../auth/useAuth'
import { LanguageSwitch } from '../components/LanguageSwitch'
import { ThemeSwitch } from '../components/ThemeToggle'
import { Card, ErrorText, Field, PageHeader } from '../components/ui'
import { DiarySettings } from './DiarySettings'
import { SymptomSettings } from './SymptomSettings'

function PasswordForm() {
  const { t } = useTranslation()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const change = useApiMutation(({ current, next }: { current: string; next: string }) => endpoints.changePassword(current, next))
  const mismatch = confirm.length > 0 && confirm !== next

  function submit(event: FormEvent) {
    event.preventDefault()
    if (mismatch) return
    change.mutate(
      { current, next },
      {
        onSuccess: () => {
          setCurrent('')
          setNext('')
          setConfirm('')
        },
      },
    )
  }

  return (
    <form onSubmit={submit} className="stack">
      <Field label={t('settings.currentPassword')}>
        <input className="input" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
      </Field>
      <Field label={t('settings.newPassword')} hint={t('setup.passwordHint')}>
        <input className="input" type="password" autoComplete="new-password" minLength={8} value={next} onChange={(e) => setNext(e.target.value)} required />
      </Field>
      <Field label={t('setup.confirmPassword')}>
        <input className="input" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
      </Field>
      {mismatch && <p className="error-text">{t('setup.mismatch')}</p>}
      <ErrorText error={change.error} />
      {change.isSuccess && <p className="saved">✓ {t('settings.passwordChanged')}</p>}
      <div>
        <button type="submit" className="btn btn-primary" disabled={change.isPending || mismatch}>
          {t('settings.changePassword')}
        </button>
      </div>
    </form>
  )
}

export function SettingsPage() {
  const { t } = useTranslation()
  const { updateUser } = useAuth()
  const [languageError, setLanguageError] = useState<unknown>(null)
  const health = useQuery({ queryKey: ['health'], queryFn: endpoints.health })
  const settings = useSettings()

  return (
    <div className="page">
      <PageHeader title={t('settings.title')} />
      <div className="two-col">
        <Card title={t('settings.language')}>
          <LanguageSwitch
            onChange={(language) => {
              setLanguageError(null)
              endpoints.setLocale(language).then(updateUser, setLanguageError)
            }}
          />
          <p className="field-hint">{t('settings.languageHint')}</p>
          <ErrorText error={languageError} />
        </Card>
        <Card title={t('settings.password')}>
          <PasswordForm />
        </Card>
      </div>
      <Card title={t('theme.label')}>
        <ThemeSwitch />
      </Card>
      {settings.data && <DiarySettings key={settings.dataUpdatedAt} settings={settings.data} />}
      <SymptomSettings />
      {health.data && (
        <p className="muted small">
          {t('settings.version', { version: health.data.version, api: health.data.apiVersion })}
        </p>
      )}
    </div>
  )
}
