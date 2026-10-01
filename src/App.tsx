import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { StoreProvider, useStore } from '@/store/StoreContext'
import { ToastProvider } from '@/components/ui/Toast'
import { Alert, Card, PageHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Database, ScrollText, TriangleAlert } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { AdmissionsPage } from '@/pages/AdmissionsPage'
import { ApplicationFormPage } from '@/pages/ApplicationFormPage'
import { StudentsPage } from '@/pages/StudentsPage'
import { ProgramsPage } from '@/pages/ProgramsPage'
import { CollegeInformationPage } from '@/pages/CollegeInformationPage'
import { CollegeLocationPage } from '@/pages/CollegeLocationPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { NotFoundPage } from '@/pages/NotFoundPage'

/** Sends unauthenticated visitors to the login screen. */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { me } = useStore()

  if (!me) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

/** Keeps signed-in users away from the login screen. */
function RedirectIfSignedIn() {
  const { me } = useStore()
  return me ? <Navigate to="/dashboard" replace /> : <LoginPage />
}

/**
 * Shown while the records load, and when the database cannot be reached.
 *
 * Without this the first paint would show an empty college, and a failed
 * connection would look like "no records yet" rather than an outage.
 */
function DataGate({ children }: { children: React.ReactNode }) {
  const { status, loadError, retry } = useStore()

  if (status === 'loading') {
    return (
      <div className="boot">
        <div className="boot__panel">
          <span className="boot__mark">
            <ScrollText size={22} />
          </span>
          <p className="boot__title">Loading records…</p>
          <p className="boot__note">Connecting to the database.</p>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="boot">
        <div className="boot__panel">
          <PageHeader title="Database unavailable" />
          <Card>
            <Alert tone="danger" icon={<TriangleAlert size={15} />} title="Could not load records">
              {loadError ?? 'The records could not be read from the database.'}
            </Alert>

            <p
              className="u-text-subtle"
              style={{ fontSize: '0.75rem', lineHeight: 1.6, marginTop: 14 }}
            >
              <Database size={11} style={{ verticalAlign: '-1px', marginRight: 4 }} />
              If this is a fresh database, make sure <code>npm run db:migrate</code> has been run
              and that <code>DATABASE_URL</code> is set.
            </p>

            <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
              <Button variant="accent" onClick={retry}>
                Try again
              </Button>
            </div>
          </Card>
        </div>
      </div>
    )
  }

  // Ready: the login screen and the authenticated shell both render.
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <StoreProvider>
        <ToastProvider>
          <DataGate>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/login" element={<RedirectIfSignedIn />} />

              <Route
                element={
                  <RequireAuth>
                    <AppLayout />
                  </RequireAuth>
                }
              >
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/admissions" element={<AdmissionsPage />} />
                <Route path="/admissions/new" element={<ApplicationFormPage />} />
                <Route path="/admissions/:id/edit" element={<ApplicationFormPage />} />
                <Route path="/students" element={<StudentsPage />} />
                <Route path="/programs" element={<ProgramsPage />} />
                <Route path="/college" element={<CollegeInformationPage />} />
                <Route path="/location" element={<CollegeLocationPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>

              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </DataGate>
        </ToastProvider>
      </StoreProvider>
    </BrowserRouter>
  )
}