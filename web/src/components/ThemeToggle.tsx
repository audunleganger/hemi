import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import * as endpoints from '../api/endpoints'
import { useSettings } from '../api/queries'
import type { SettingsDto } from '../api/types.gen'
import { setTheme, THEMES, useTheme, type Theme } from '../lib/theme'

/** Applies a theme at once and saves it with the account (S-4). */
function useChangeTheme() {
  const settings = useSettings()
  const client = useQueryClient()
  return (theme: Theme) => {
    setTheme(theme)
    const current = settings.data
    if (current) {
      const { locale: _locale, calendarFeed: _feed, ...input } = current
      void endpoints.updateSettings({ ...input, theme }).then((saved: SettingsDto) => client.setQueryData(['settings'], saved))
    }
  }
}

/** Quick switch between dark and light (DS-4). */
export function ThemeToggle() {
  const { t } = useTranslation()
  const { resolved } = useTheme()
  const change = useChangeTheme()
  const next = resolved === 'dark' ? 'light' : 'dark'
  return (
    <button
      type="button"
      className="btn btn-ghost btn-small btn-icon"
      onClick={() => change(next)}
      aria-label={t('theme.toggle', { theme: t(`theme.${next}`).toLowerCase() })}
      title={t('theme.toggle', { theme: t(`theme.${next}`).toLowerCase() })}
    >
      {resolved === 'dark' ? '☀' : '☾'}
    </button>
  )
}

/** The full theme setting: dark, light or follow the system (S-4). */
export function ThemeSwitch() {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const change = useChangeTheme()
  return (
    <div className="segmented" role="group" aria-label={t('theme.label')}>
      {THEMES.map((option) => (
        <button key={option} type="button" className={theme === option ? 'active' : ''} aria-pressed={theme === option} onClick={() => change(option)}>
          {t(`theme.${option}`)}
        </button>
      ))}
    </div>
  )
}
