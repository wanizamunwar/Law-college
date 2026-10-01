import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { AlertCircle, FileText, GraduationCap, ScrollText, Users } from 'lucide-react'
import { useStore } from '@/store/StoreContext'
import { Button } from '@/components/ui/Button'
import { PasswordInput, Input } from '@/components/ui/Form'
import { Alert } from '@/components/ui/Card'

const FEATURES = [
  { icon: <FileText size={15} />, label: 'Admission applications with document tracking' },
  { icon: <GraduationCap size={15} />, label: 'Student records and enrolment' },
  { icon: <Users size={15} />, label: 'Programme and curriculum management' },
]

export function LoginPage() {
  const { me, signIn, settings, status } = useStore()
  const navigate = useNavigate()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (me) {
    return <Navigate to="/dashboard" replace />
  }

  const collegeName = settings.college.shortName || settings.college.name || 'Law College'

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (!username.trim() || !password) {
      setError('Enter both your username and password.')
      return
    }

    setSubmitting(true)
    const result = await signIn(username, password)

    if (result.ok) {
      navigate('/dashboard', { replace: true })
      return
    }

    setSubmitting(false)
    setError(result.message ?? 'Sign in failed. Please try again.')
    setPassword('')
  }

  return (
    <div className="login">
      <aside className="login__aside">
        <div className="login__brand">
          <span className="login__crest">
            {settings.college.logoDataUrl ? (
              <img src={settings.college.logoDataUrl} alt="" />
            ) : (
              <ScrollText size={20} />
            )}
          </span>
          <span>
            <span className="login__brand-name">{collegeName}</span>
            <br />
            <span className="login__brand-sub">Office of the Registrar</span>
          </span>
        </div>

        <div>
          <h1 className="login__headline">Administration Portal</h1>
          <p className="login__lead">
            A single record of admissions, enrolment and programme information for the faculty and
            its registry.
          </p>

          <div className="login__features">
            {FEATURES.map((feature) => (
              <div className="login__feature" key={feature.label}>
                {feature.icon}
                {feature.label}
              </div>
            ))}
          </div>
        </div>

        <p className="login__foot">
          Authorised personnel only. All activity is recorded against the signed-in account.
        </p>
      </aside>

      <main className="login__main">
        <div className="login__panel">
          <h2 className="login__title">Sign in</h2>
          <p className="login__subtitle">
            Enter your staff credentials to continue.
          </p>

          <form className="login__form" onSubmit={handleSubmit} noValidate>
            {error && (
              <Alert tone="danger" icon={<AlertCircle size={15} />}>
                {error}
              </Alert>
            )}

            <Input
              label="Username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              placeholder="admin"
              autoFocus
              required
            />

            <PasswordInput
              label="Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
              required
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              block
              className="login__submit"
              disabled={submitting || status === 'loading'}
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <div className="login__hint">
            <strong>First time here?</strong>
            <br />
            Sign in with the administrator account created by{' '}
            <code>npm run db:migrate</code>, then add your colleagues under{' '}
            <strong>Settings → Staff</strong>. Each account can be a registrar (full access) or a
            viewer (read-only).
          </div>
        </div>
      </main>
    </div>
  )
}
