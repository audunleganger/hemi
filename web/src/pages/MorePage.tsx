import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useAuth, useUser } from '../auth/useAuth'
import { ThemeSwitch } from '../components/ThemeToggle'
import { Card, PageHeader } from '../components/ui'

/** "More" on phones and tablets (DS-1): everything that isn't in their navigation. */
export function MorePage() {
  const { t } = useTranslation()
  const { logout } = useAuth()
  const user = useUser()
  return (
    <div className="page">
      <PageHeader title={t('nav.more')} />
      <Card>
        <nav className="link-list">
          <Link to="/doses">{t('nav.doses')}</Link>
          <Link to="/settings">{t('nav.settings')}</Link>
          {user.isAdmin && <Link to="/admin">{t('nav.admin')}</Link>}
        </nav>
      </Card>
      <Card title={t('theme.label')}>
        <ThemeSwitch />
      </Card>
      <div>
        <button type="button" className="btn" onClick={() => void logout()}>
          {t('nav.logout')}
        </button>
      </div>
    </div>
  )
}
