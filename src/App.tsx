import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { StoreProvider, useStore } from '@/store/StoreContext'
import { ToastProvider } from '@/components/ui/Toast'
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
  const { session } = useStore()

  if (!session) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

/** Keeps signed-in users away from the login screen. */
function RedirectIfSignedIn() {
  const { session } = useStore()
  return session ? <Navigate to="/dashboard" replace /> : <LoginPage />
}

export default function App() {
  return (
    <BrowserRouter>
      <StoreProvider>
        <ToastProvider>
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
        </ToastProvider>
      </StoreProvider>
    </BrowserRouter>
  )
}