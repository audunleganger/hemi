import { useEffect, useRef } from 'react'
import { NavLink, Outlet } from 'react-router'
import { useTranslation } from 'react-i18next'
import * as endpoints from '../api/endpoints'
import { useHome, useSettings } from '../api/queries'
import { useAuth, useUser } from '../auth/useAuth'
import { setTheme, useTheme } from '../lib/theme'
import { browserTimeZone } from '../lib/time'
import { RecordProvider, useRecord } from '../record/RecordContext'
import { ThemeToggle } from './ThemeToggle'
import { ToastProvider } from './Toast'

/**
 * Applies the user's saved theme once, sets the time zone from the browser while it's unset (S-4), and
 * dims the whole app while an attack is ongoing (V-7, DS-4).
 */
function useAppearance() {
  const settings = useSettings()
  const home = useHome()
  const { resolved } = useTheme()
  const applied = useRef(false)

  useEffect(() => {
    if (!settings.data || applied.current) return
    applied.current = true
    setTheme(settings.data.theme)
    const zone = browserTimeZone()
    if (!settings.data.timeZone && zone) void endpoints.setTimeZone(zone).then(() => settings.refetch())
  }, [settings])

  const ongoing = home.data?.ongoing != null
  const dim = ongoing && (resolved === 'dark' || settings.data?.dimDuringAttacks !== false)
  useEffect(() => {
    document.documentElement.classList.toggle('attack-mode', dim)
    return () => document.documentElement.classList.remove('attack-mode')
  }, [dim])
  return { ongoing }
}

function RecordButton({ className }: { className: string }) {
  const { t } = useTranslation()
  const record = useRecord()
  return (
    <button type="button" className={className} onClick={() => record.open({ kind: 'menu' })}>
      {t('record.button')}
    </button>
  )
}

/**
 * The app frame (DS-1): on PCs a top bar with the navigation and + Record; on tablets the same bar with the
 * phone's items (Settings, Admin and Log out move to More); on phones a bottom navigation (Calendar · Diary ·
 * Medications · More) with a floating + Record button above it. During an attack, "Now" (the attack screen)
 * comes first and the calendar has its own place (DS-3).
 */
function Frame() {
  const { t } = useTranslation()
  const { logout } = useAuth()
  const user = useUser()
  const { ongoing } = useAppearance()
  const main: { to: string; label: string; end?: boolean; only?: 'pc' | 'tablet' }[] = [
    ...(ongoing ? [{ to: '/', label: t('nav.now'), end: true }, { to: '/calendar', label: t('nav.calendar') }] : [{ to: '/', label: t('nav.calendar'), end: true }]),
    { to: '/diary', label: t('nav.diary') },
    { to: '/medications', label: t('nav.medications') },
  ]
  // `pc` links show only on PCs, `more` only on tablets.
  const wide: typeof main = [
    ...main,
    { to: '/doses', label: t('nav.doses'), only: 'pc' as const },
    { to: '/settings', label: t('nav.settings'), only: 'pc' as const },
    ...(user.isAdmin ? [{ to: '/admin', label: t('nav.admin'), only: 'pc' as const }] : []),
    { to: '/more', label: t('nav.more'), only: 'tablet' as const },
  ]
  const linkClass = ({ isActive }: { isActive: boolean }) => `nav-link ${isActive ? 'active' : ''}`
  const phone = [...main, { to: '/more', label: t('nav.more') }]
  return (
    <div className="app">
      <header className="topbar">
        <NavLink to="/" className="brand">
          {t('appName')}
        </NavLink>
        <nav className="nav nav-wide" aria-label={t('nav.label')}>
          {wide.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) => `${linkClass({ isActive })} ${link.only ? `only-${link.only}` : ''}`}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="user-menu">
          <ThemeToggle />
          <span className="muted only-pc">{user.username}</span>
          <button type="button" className="btn btn-ghost btn-small only-pc" onClick={() => void logout()}>
            {t('nav.logout')}
          </button>
          <RecordButton className="btn btn-primary record-top" />
        </div>
      </header>
      <main className="content">
        <Outlet />
      </main>
      <RecordButton className="record-fab" />
      <nav className="bottom-nav" style={{ gridTemplateColumns: `repeat(${phone.length}, 1fr)` }} aria-label={t('nav.label')}>
        {phone.map((link) => (
          <NavLink key={link.to} to={link.to} end={link.end} className={linkClass}>
            {link.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

export function Layout() {
  return (
    <ToastProvider>
      <RecordProvider>
        <Frame />
      </RecordProvider>
    </ToastProvider>
  )
}
