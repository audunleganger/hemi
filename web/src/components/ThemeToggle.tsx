import { useTranslation } from 'react-i18next'
import { setTheme, THEMES, useTheme } from '../lib/theme'

/** Quick switch between dark and light (DS-4). */
export function ThemeToggle() {
  const { t } = useTranslation()
  const { resolved } = useTheme()
  const next = resolved === 'dark' ? 'light' : 'dark'
  return (
    <button
      type="button"
      className="btn btn-ghost btn-small btn-icon"
      onClick={() => setTheme(next)}
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
  return (
    <div className="segmented" role="group" aria-label={t('theme.label')}>
      {THEMES.map((option) => (
        <button key={option} type="button" className={theme === option ? 'active' : ''} aria-pressed={theme === option} onClick={() => setTheme(option)}>
          {t(`theme.${option}`)}
        </button>
      ))}
    </div>
  )
}
