import { useTranslation } from 'react-i18next'
import { Card, PageHeader } from '../components/ui'

/** Home: the calendar with the selected day, or the attack screen during an attack (V-1, DS-2, DS-3). */
export function HomePage() {
  const { t } = useTranslation()
  return (
    <div className="page">
      <PageHeader title={t('nav.calendar')} />
      <Card>
        <p className="muted">{t('common.comingSoon')}</p>
      </Card>
    </div>
  )
}
