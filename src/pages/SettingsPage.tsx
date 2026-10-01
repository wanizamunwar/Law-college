import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Database,
  Download,
  KeyRound,
  Save,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  Upload,
  User,
} from 'lucide-react'
import { useStore } from '@/store/StoreContext'
import { Alert, Card, PageHeader } from '@/components/ui/Card'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Input, PasswordInput } from '@/components/ui/Form'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import { DEFAULT_SETTINGS } from '@/lib/defaults'
import { formatBytes } from '@/lib/format'
import type { ImportPayload } from '@/store/StoreContext'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

type Section = 'profile' | 'security' | 'data'

export function SettingsPage() {
  const {
    settings,
    updateSettings,
    signOut,
    applications,
    programs,
    students,
    storageBytes,
    resetAllData,
    loadDemoData,
    importData,
  } = useStore()

  const toast = useToast()
  const navigate = useNavigate()

  const [section, setSection] = useState<Section>('profile')

  /* --------------------------- Profile --------------------------- */
  const [displayName, setDisplayName] = useState(settings.admin.displayName)
  const [username, setUsername] = useState(settings.admin.username)
  const [profileErrors, setProfileErrors] = useState<{
    displayName?: string
    username?: string
  }>({})

  /* --------------------------- Security -------------------------- */
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [securityErrors, setSecurityErrors] = useState<{
    currentPassword?: string
    newPassword?: string
    confirmPassword?: string
  }>({})
  const [securityOpen, setSecurityOpen] = useState(false)
  const passwordFormRef = useRef<HTMLFormElement>(null)

  /* ----------------------------- Data ---------------------------- */
  const [resetOpen, setResetOpen] = useState(false)
  const [demoOpen, setDemoOpen] = useState(false)
  const importInputRef = useRef<HTMLInputElement>(null)

  const profileDirty =
    displayName !== settings.admin.displayName || username !== settings.admin.username

  const handleSaveProfile = (event: React.FormEvent) => {
    event.preventDefault()

    const next: typeof profileErrors = {}
    if (!displayName.trim()) next.displayName = 'Display name is required.'
    if (!username.trim()) next.username = 'Username is required.'
    else if (!/^[a-zA-Z0-9._-]{3,24}$/.test(username.trim())) {
      next.username = 'Use 3–24 letters, numbers, dots, dashes or underscores.'
    }

    setProfileErrors(next)
    if (Object.keys(next).length > 0) return

    updateSettings({
      ...settings,
      admin: {
        ...settings.admin,
        displayName: displayName.trim(),
        username: username.trim(),
      },
    })

    toast.success('Profile updated', 'Your administrator details have been saved.')
  }

  const openSecurity = () => {
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setSecurityErrors({})
    setSecurityOpen(true)
  }

  const handleChangePassword = (event: React.FormEvent) => {
    event.preventDefault()

    // The form lives inside the dialog; a native submit keeps validation and
    // Enter-to-submit working instead of dispatching a synthetic event.
    if (!passwordFormRef.current?.reportValidity()) return

    const next: typeof securityErrors = {}
    if (currentPassword !== settings.admin.password) {
      next.currentPassword = 'The current password is incorrect.'
    }
    if (newPassword.length < 6) {
      next.newPassword = 'The new password must be at least 6 characters.'
    }
    if (newPassword !== confirmPassword) {
      next.confirmPassword = 'The two passwords do not match.'
    }

    setSecurityErrors(next)
    if (Object.keys(next).length > 0) return

    updateSettings({
      ...settings,
      admin: { ...settings.admin, password: newPassword },
    })

    setSecurityOpen(false)
    toast.success('Password changed', 'Use the new password the next time you sign in.')
  }

  /* ---------------------------- Export ---------------------------- */

  const handleExport = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      version: 1,
      programs,
      applications,
      students,
      settings: {
        college: settings.college,
        admin: { username: settings.admin.username, displayName: settings.admin.displayName },
      },
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `law-college-backup-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    setTimeout(() => URL.revokeObjectURL(url), 1000)

    toast.success('Backup downloaded', 'Your records have been exported as a JSON file.')
  }

  const [importPending, setImportPending] = useState(false)

  const handleImport = (file: File) => {
    const reader = new FileReader()

    reader.onload = () => {
      setImportPending(false)
      try {
        const parsed = JSON.parse(String(reader.result)) as ImportPayload

        if (!isRecord(parsed)) {
          toast.error('Invalid file', 'This file is not a Law College backup.')
          return
        }

        const result = importData(parsed)

        if (!result.ok) {
          toast.error('Nothing imported', result.message)
          return
        }

        const counts = result.counts
        toast.success(
          'Backup restored',
          `Imported ${counts?.programs ?? 0} programs, ${counts?.applications ?? 0} applications and ${counts?.students ?? 0} students. Existing records with the same ID were updated.`,
        )
      } catch {
        toast.error('Invalid file', 'The selected file is not valid JSON.')
      }
    }

    reader.onerror = () => {
      setImportPending(false)
      toast.error('Read failed', 'The file could not be read.')
    }

    setImportPending(true)
    reader.readAsText(file)
  }

  const handleReset = () => {
    resetAllData()
    setResetOpen(false)
    toast.success('All data cleared', 'Programs, applications and students have been removed.')
  }

  const handleLoadDemo = () => {
    loadDemoData()
    setDemoOpen(false)
    toast.success(
      'Sample data loaded',
      'Four programs, eight applications and enrolled students are now available.',
    )
  }

  const usagePercent = Math.min(100, Math.round((storageBytes / (5 * 1024 * 1024)) * 100))

  const sections: Array<{ key: Section; label: string; icon: React.ReactNode }> = [
    { key: 'profile', label: 'Administrator', icon: <User size={15} /> },
    { key: 'security', label: 'Security', icon: <ShieldCheck size={15} /> },
    { key: 'data', label: 'Data & Storage', icon: <Database size={15} /> },
  ]

  return (
    <>
      <PageHeader
        title="Settings"
        description="Administrator account, password and local data management."
      />

      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings sections">
          {sections.map((item) => (
            <button
              key={item.key}
              type="button"
              className={[
                'settings-nav__item',
                section === item.key ? 'settings-nav__item--active' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => setSection(item.key)}
              aria-current={section === item.key ? 'page' : undefined}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        <div>
          {/* -------------------------- Profile -------------------------- */}
          {section === 'profile' && (
            <Card title="Administrator Profile" subtitle="Details shown in the top bar">
              <form onSubmit={handleSaveProfile} noValidate>
                <div className="form-grid form-grid--2">
                  <Input
                    label="Display Name"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder="e.g. Registrar"
                    error={profileErrors.displayName}
                    required
                  />
                  <Input
                    label="Username"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    autoComplete="username"
                    error={profileErrors.username}
                    hint="Used to sign in. Letters, numbers, dots, dashes and underscores."
                    required
                  />
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: 8,
                    marginTop: 18,
                    flexWrap: 'wrap',
                  }}
                >
                  <Button
                    onClick={() => {
                      setDisplayName(settings.admin.displayName)
                      setUsername(settings.admin.username)
                      setProfileErrors({})
                    }}
                    disabled={!profileDirty}
                  >
                    Discard
                  </Button>
                  <Button
                    type="submit"
                    variant="accent"
                    icon={<Save size={14} />}
                    disabled={!profileDirty}
                  >
                    Save profile
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {/* -------------------------- Security ------------------------- */}
          {section === 'security' && (
            <div className="u-stack-16">
              <Card title="Password" subtitle="Credentials for this administration portal">
                <div className="setting-row" style={{ borderBottom: 'none', paddingBottom: 0 }}>
                  <div className="setting-row__text">
                    <p className="setting-row__title">Administrator password</p>
                    <p className="setting-row__desc">
                      Change the password used to sign in. Use at least six characters, and avoid
                      reusing it elsewhere.
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    icon={<KeyRound size={14} />}
                    onClick={openSecurity}
                  >
                    Change password
                  </Button>
                </div>
              </Card>

              <Card title="Session" subtitle="Current sign-in">
                <div className="setting-row" style={{ borderBottom: 'none', paddingBottom: 0 }}>
                  <div className="setting-row__text">
                    <p className="setting-row__title">Sign out of this device</p>
                    <p className="setting-row__desc">
                      Ends the current session and returns you to the login screen. No data is
                      deleted.
                    </p>
                  </div>
                  <Button
                    variant="danger"
                    icon={<Trash2 size={14} />}
                    onClick={() => {
                      signOut()
                      navigate('/login', { replace: true })
                    }}
                  >
                    Sign out
                  </Button>
                </div>
              </Card>
            </div>
          )}

          {/* ---------------------------- Data --------------------------- */}
          {section === 'data' && (
            <div className="u-stack-16">
              <Card title="Records" subtitle="What is currently stored in this browser">
                <div className="setting-row">
                  <div className="setting-row__text">
                    <p className="setting-row__title">Programs</p>
                    <p className="setting-row__desc">Programmes available for admission.</p>
                  </div>
                  <span className="badge badge--neutral">{programs.length}</span>
                </div>
                <div className="setting-row">
                  <div className="setting-row__text">
                    <p className="setting-row__title">Applications</p>
                    <p className="setting-row__desc">Admission applications and their status.</p>
                  </div>
                  <span className="badge badge--neutral">{applications.length}</span>
                </div>
                <div className="setting-row">
                  <div className="setting-row__text">
                    <p className="setting-row__title">Students</p>
                    <p className="setting-row__desc">Enrolled student records.</p>
                  </div>
                  <span className="badge badge--neutral">{students.length}</span>
                </div>
              </Card>

              <Card title="Storage" subtitle="Browser storage used by this application">
                <div style={{ marginBottom: 14 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '0.75rem',
                      marginBottom: 6,
                    }}
                  >
                    <span className="u-text-muted">Local storage</span>
                    <span style={{ fontWeight: 600 }}>
                      {formatBytes(storageBytes)} of ~5 MB ({usagePercent}%)
                    </span>
                  </div>
                  <div
                    style={{
                      height: 6,
                      background: 'var(--paper)',
                      border: '1px solid var(--line)',
                      borderRadius: 4,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.max(usagePercent, 1)}%`,
                        height: '100%',
                        background:
                          usagePercent > 80 ? 'var(--danger)' : 'var(--brass-500)',
                      }}
                    />
                  </div>
                </div>

                <p className="u-text-subtle" style={{ fontSize: '0.75rem', lineHeight: 1.6 }}>
                  Records are held in this browser only — no data is sent to a server. Uploaded
                  documents are stored separately in IndexedDB and are not included in the storage
                  figure above.
                </p>
              </Card>

              <Card title="Backup & Restore" subtitle="Export or import your records">
                <div className="setting-row">
                  <div className="setting-row__text">
                    <p className="setting-row__title">Export a backup</p>
                    <p className="setting-row__desc">
                      Downloads programs, applications, students and the college profile as a JSON
                      file.
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    icon={<Download size={14} />}
                    onClick={handleExport}
                    disabled={
                      programs.length === 0 &&
                      applications.length === 0 &&
                      students.length === 0
                    }
                  >
                    Export
                  </Button>
                </div>

                <div className="setting-row">
                  <div className="setting-row__text">
                    <p className="setting-row__title">Import a backup</p>
                    <p className="setting-row__desc">
                      Restores a previously exported JSON file. Records are merged by ID, so
                      re-importing the same backup will not create duplicates.
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    icon={<Upload size={14} />}
                    onClick={() => importInputRef.current?.click()}
                    disabled={importPending}
                  >
                    {importPending ? 'Reading…' : 'Import'}
                  </Button>
                  <input
                    ref={importInputRef}
                    type="file"
                    accept="application/json,.json"
                    className="u-visually-hidden"
                    aria-label="Import backup file"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      event.target.value = ''
                      if (file) handleImport(file)
                    }}
                  />
                </div>

                <div className="setting-row">
                  <div className="setting-row__text">
                    <p className="setting-row__title">Load sample data</p>
                    <p className="setting-row__desc">
                      Replaces the current data with a realistic demonstration set so the tables,
                      filters and dashboard can be reviewed.
                    </p>
                  </div>
                  <Button variant="secondary" icon={<Database size={14} />} onClick={() => setDemoOpen(true)}>
                    Load sample data
                  </Button>
                </div>
              </Card>

              <Card title="Danger Zone" subtitle="Irreversible actions">
                <Alert
                  tone="danger"
                  icon={<TriangleAlert size={15} />}
                  title="Clearing all data"
                  className="no-print"
                >
                  Removing all data deletes every program, application, student record and
                  uploaded document from this browser, and restores the college profile to its
                  default values. Export a backup first if you may need this information later.
                </Alert>

                <div className="setting-row" style={{ marginTop: 4 }}>
                  <div className="setting-row__text">
                    <p className="setting-row__title">Clear all data</p>
                    <p className="setting-row__desc">
                      Returns the system to a freshly installed state.
                    </p>
                  </div>
                  <Button variant="danger" icon={<Trash2 size={14} />} onClick={() => setResetOpen(true)}>
                    Clear all data
                  </Button>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* ---------------------- Change password ---------------------- */}
      <ConfirmDialog
        open={securityOpen}
        title="Change password"
        confirmLabel="Update password"
        onCancel={() => setSecurityOpen(false)}
        onConfirm={() => {
          // Submit the form rendered inside the dialog body.
          passwordFormRef.current?.requestSubmit()
        }}
        message={
          <form ref={passwordFormRef} onSubmit={handleChangePassword} noValidate>
            <div style={{ display: 'grid', gap: 14 }}>
              <PasswordInput
                label="Current password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
                error={securityErrors.currentPassword}
                required
              />
              <PasswordInput
                label="New password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                hint="At least 6 characters."
                error={securityErrors.newPassword}
                required
              />
              <PasswordInput
                label="Confirm new password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                error={securityErrors.confirmPassword}
                required
              />
            </div>
          </form>
        }
      />

      {/* -------------------------- Reset data ------------------------ */}
      <ConfirmDialog
        open={resetOpen}
        title="Clear all data"
        destructive
        confirmLabel="Delete everything"
        message={
          <>
            This permanently deletes <strong>{programs.length} programmes</strong>,{' '}
            <strong>{applications.length} applications</strong>,{' '}
            <strong>{students.length} students</strong> and all uploaded documents from this
            browser. The college profile will be restored to its defaults and you will stay signed
            in with your current credentials.
          </>
        }
        onConfirm={handleReset}
        onCancel={() => setResetOpen(false)}
      />

      {/* ------------------------ Sample data ------------------------- */}
      <ConfirmDialog
        open={demoOpen}
        title="Load sample data"
        confirmLabel="Load sample data"
        message={
          <>
            This replaces the current programs, applications and students with a demonstration
            dataset of {programs.length === 0 ? '' : `${programs.length} programs, `}
            eight applications and enrolled students. The college profile will also be filled in
            with example details.
            {programs.length > 0 && (
              <>
                <br />
                <br />
                <strong>Your existing records will be replaced.</strong>
              </>
            )}
          </>
        }
        onConfirm={handleLoadDemo}
        onCancel={() => setDemoOpen(false)}
      />

      {section === 'data' && (
        <p className="u-text-subtle" style={{ marginTop: 16, fontSize: '0.75rem' }}>
          Need to update the college profile instead?{' '}
          <ButtonLink to="/college" variant="ghost" size="sm">
            Open College Information
          </ButtonLink>
        </p>
      )}

      <p className="u-text-subtle" style={{ marginTop: 22, fontSize: '0.75rem' }}>
        Default credentials for a fresh install are{' '}
        <code style={{ fontFamily: 'var(--font-mono)' }}>{DEFAULT_SETTINGS.admin.username}</code> /{' '}
        <code style={{ fontFamily: 'var(--font-mono)' }}>{DEFAULT_SETTINGS.admin.password}</code>.
      </p>
    </>
  )
}