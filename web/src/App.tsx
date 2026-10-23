import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router'
import { ApiError, NETWORK_ERROR } from './api/client'
import { AuthProvider } from './auth/AuthProvider'
import { useAuth } from './auth/useAuth'
import { Layout } from './components/Layout'
import { Loading } from './components/ui'
import { AdminPage } from './pages/AdminPage'
import { DiaryPage } from './pages/DiaryPage'
import { DosesPage } from './pages/DosesPage'
import { HomePage } from './pages/HomePage'
import { AttackPage } from './pages/AttackPage'
import { LoginPage, SetupPage } from './pages/LoginPage'
import { MedicationsPage } from './pages/MedicationsPage'
import { MorePage } from './pages/MorePage'
import { SettingsPage } from './pages/SettingsPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      // Retry only when the server was unreachable; 4xx answers won't change on retry.
      retry: (failures, error) => error instanceof ApiError && error.code === NETWORK_ERROR && failures < 2,
    },
  },
})

function NotFound() {
  const { t } = useTranslation()
  return (
    <div className="card">
      <h1>{t('errors.pageNotFound')}</h1>
      <Link to="/">{t('nav.calendar')}</Link>
    </div>
  )
}

function Gate() {
  const { t } = useTranslation()
  const { state, retry } = useAuth()
  switch (state.status) {
    case 'loading':
      return (
        <div className="center-screen">
          <Loading />
        </div>
      )
    case 'unreachable':
      return (
        <div className="center-screen">
          <div className="card narrow">
            <h1>{t('server.unreachableTitle')}</h1>
            <p>{t('server.unreachableText')}</p>
            <button type="button" className="btn btn-primary" onClick={retry}>
              {t('server.retry')}
            </button>
          </div>
        </div>
      )
    case 'incompatible':
      return (
        <div className="center-screen">
          <div className="card narrow">
            <h1>{t('server.incompatibleTitle')}</h1>
            <p>{t('server.incompatibleText', { server: state.serverApiVersion })}</p>
          </div>
        </div>
      )
    case 'setup':
      return <SetupPage />
    case 'anonymous':
      return <LoginPage />
    case 'authenticated':
      return (
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="calendar" element={<HomePage calendar />} />
            <Route path="diary" element={<DiaryPage />} />
            <Route path="attacks" element={<Navigate to="/diary" replace />} />
            <Route path="attacks/:id" element={<AttackPage />} />
            <Route path="doses" element={<DosesPage />} />
            <Route path="medications" element={<MedicationsPage />} />
            <Route path="more" element={<MorePage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="admin" element={<AdminPage />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      )
  }
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Gate />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
