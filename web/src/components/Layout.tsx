import { NavLink, Outlet } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useAuth, useUser } from '../auth/useAuth'
import { ThemeToggle } from './ThemeToggle'

/**
 * The app frame (DS-1): on PCs and tablets a top bar with the navigation; on phones a bottom
 * navigation (Calendar · Attacks · Medications · More).
 */
export function Layout() {
  const { t } = useTranslation()
  const { logout } = useAuth()
  const user = useUser()
  const main = [
    { to: '/', label: t('nav.calendar'), end: true },
    { to: '/attacks', label: t('nav.attacks') },
    { to: '/medications', label: t('nav.medications') },
  ]
  const wide = [...main, { to: '/settings', label: t('nav.settings') }, ...(user.isAdmin ? [{ to: '/admin', label: t('nav.admin') }] : [])]
  const linkClass = ({ isActive }: { isActive: boolean }) => `nav-link ${isActive ? 'active' : ''}`
  return (
    <div className="app">
      <header className="topbar">
        <NavLink to="/" className="brand">
          {t('appName')}
        </NavLink>
        <nav className="nav nav-wide" aria-label={t('nav.label')}>
          {wide.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end} className={linkClass}>
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="user-menu">
          <ThemeToggle />
          <span className="muted">{user.username}</span>
          <button type="button" className="btn btn-ghost btn-small" onClick={() => void logout()}>
            {t('nav.logout')}
          </button>
        </div>
      </header>
      <main className="content">
        <Outlet />
      </main>
      <nav className="bottom-nav" aria-label={t('nav.label')}>
        {[...main, { to: '/more', label: t('nav.more') }].map((link) => (
          <NavLink key={link.to} to={link.to} end={link.end} className={linkClass}>
            {link.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
