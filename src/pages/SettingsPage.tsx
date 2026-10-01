import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Database,
  Download,
  HardDriveDownload,
  KeyRound,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  Upload,
  User,
  Users,
} from 'lucide-react'
import { useStore } from '@/store/StoreContext'
import type { ImportPayload } from '@/store/StoreContext'
import { Alert, Badge, Card, PageHeader } from '@/components/ui/Card'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Input, PasswordInput, Select } from '@/components/ui/Form'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import type { Role, StaffUser } from '@/types'
import { formatDate } from '@/lib/format'

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function describeError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

const ROLE_OPTIONS: Array<{ value: Role; label: string }> = [
  { value: 'admin', label: 'Administrator' },
  { value: 'registrar', label: 'Registrar' },
  { value: 'viewer', label: 'Read-only' },
]

const ROLE_SUMMARY: Record<Role, string> = {
  admin: 'Full access, including staff accounts and clearing the database.',
  registrar: 'Can create, edit and delete every academic record.',
  viewer: 'Can read the system but cannot change anything.',
}

type Section = 'account' | 'staff' | 'data'

export function SettingsPage() {
  const {
    me,
    isAdmin,
    canEdit,
    signOut,
    changeOwnPassword,
    settings,
    applications,
    programs,
    students,
    staff,
    loadStaff,
    createStaff,
    updateStaff,
    deleteStaff,
    resetAllData,
    loadDemoData,
    importData,
    legacyCount,
    migrateLegacyData,
  } = useStore()

  const toast = useToast()
  const navigate = useNavigate()

  const [section, setSection] = useState<Section>('account')

  /* ----------------------------- Password ---------------------------- */
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordErrors, setPasswordErrors] = useState<{
    currentPassword?: string
    newPassword?: string
    confirmPassword?: string
  }>({})
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const passwordFormRef = useRef<HTMLFormElement>(null)

  /* ------------------------------ Staff ------------------------------ */
  const [staffLoading, setStaffLoading] = useState(false)
  const [staffErrors, setStaffErrors] = useState<{
    username?: string
    displayName?: string
    password?: string
  }>({})
  const [newUsername, setNewUsername] = useState('')
  const [newDisplayName, setNewDisplayName] = useState('')
  const [newPassword2, setNewPassword2] = useState('')
  const [newRole, setNewRole] = useState<Role>('registrar')
  const [creatingStaff, setCreatingStaff] = useState(false)
  const [busyStaffId, setBusyStaffId] = useState<string | null>(null)
  const [removeTarget, setRemoveTarget] = useState<StaffUser | null>(null)

  /* ------------------------------ Data ------------------------------- */
  const [resetOpen, setResetOpen] = useState(false)
  const [demoOpen, setDemoOpen] = useState(false)
  const [importPending, setImportPending] = useState(false)
  const [migrating, setMigrating] = useState(false)
  const [busyData, setBusyData] = useState(false)
  const importInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (section === 'staff' && isAdmin) void loadStaff()
  }, [section, isAdmin, loadStaff])

  /* --------------------------- Password flow -------------------------- */

  const openPassword = () => {
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setPasswordErrors({})
    setPasswordOpen(true)
  }

  const handleChangePassword = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!passwordFormRef.current?.reportValidity()) return

    const next: typeof passwordErrors = {}
    if (newPassword.length < 8) {
      next.newPassword = 'The new password must be at least 8 characters.'
    }
    if (newPassword !== confirmPassword) {
      next.confirmPassword = 'The two passwords do not match.'
    }

    setPasswordErrors(next)
    if (Object.keys(next).length > 0) return

    setChangingPassword(true)
    try {
      await changeOwnPassword(currentPassword, newPassword)
      setPasswordOpen(false)
      toast.success('Password changed', 'Use the new password the next time you sign in.')
    } catch (error) {
      setPasswordErrors({
        currentPassword: describeError(error, 'The password could not be changed.'),
      })
    } finally {
      setChangingPassword(false)
    }
  }

  /* ---------------------------- Staff flow --------------------------- */

  const refreshStaff = async () => {
    setStaffLoading(true)
    try {
      await loadStaff()
    } catch (error) {
      toast.error('Could not load accounts', describeError(error, 'Please try again.'))
    } finally {
      setStaffLoading(false)
    }
  }

  const handleCreateStaff = async (event: React.FormEvent) => {
    event.preventDefault()

    const next: typeof staffErrors = {}
    if (!newDisplayName.trim()) next.displayName = 'Display name is required.'
    if (!/^[a-zA-Z0-9._-]{3,24}$/.test(newUsername.trim())) {
      next.username = 'Use 3–24 letters, numbers, dots, dashes or underscores.'
    }
    if (newPassword2.length < 8) next.password = 'The password must be at least 8 characters.'

    setStaffErrors(next)
    if (Object.keys(next).length > 0) return

    setCreatingStaff(true)
    try {
      await createStaff({
        username: newUsername.trim(),
        displayName: newDisplayName.trim(),
        password: newPassword2,
        role: newRole,
      })
      setNewUsername('')
      setNewDisplayName('')
      setNewPassword2('')
      setNewRole('registrar')
      setStaffErrors({})
      toast.success('Account created', `${newDisplayName.trim()} can now sign in.`)
    } catch (error) {
      setStaffErrors({ username: describeError(error, 'The account could not be created.') })
    } finally {
      setCreatingStaff(false)
    }
  }

  const patchStaff = async (user: StaffUser, patch: Parameters<typeof updateStaff>[1]) => {
    setBusyStaffId(user.id)
    try {
      await updateStaff(user.id, patch)
      toast.success('Account updated', `${user.displayName}'s access has changed.`)
    } catch (error) {
      toast.error('Could not update account', describeError(error, 'Please try again.'))
    } finally {
      setBusyStaffId(null)
    }
  }

  const handleRemoveStaff = async () => {
    if (!removeTarget) return

    const target = removeTarget
    setRemoveTarget(null)
    setBusyStaffId(target.id)
    try {
      await deleteStaff(target.id)
      toast.success('Account removed', `${target.displayName} can no longer sign in.`)
    } catch (error) {
      toast.error('Could not remove account', describeError(error, 'Please try again.'))
    } finally {
      setBusyStaffId(null)
    }
  }

  const resetStaffPassword = async (user: StaffUser) => {
    // A generated password beats a shared one: it is handed over out of band.
    const suggestion = `${user.username}-${Math.random().toString(36).slice(2, 8)}`
    setBusyStaffId(user.id)
    try {
      await updateStaff(user.id, { password: suggestion })
      toast.success('Password reset', `Give ${user.displayName} this password: ${suggestion}`)
    } catch (error) {
      toast.error('Could not reset password', describeError(error, 'Please try again.'))
    } finally {
      setBusyStaffId(null)
    }
  }

  /* ---------------------------- Export ------------------------------- */

  const handleExport = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      version: 1,
      programs,
      applications,
      students,
      settings: { college: settings.college },
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

    toast.success(
      'Backup downloaded',
      'Uploaded document files are not included — they live in the database.',
    )
  }

  const handleImport = async (file: File) => {
    setImportPending(true)
    try {
      const text = await file.text()
      const parsed: unknown = JSON.parse(text)

      if (!isRecord(parsed)) {
        toast.error('Invalid file', 'This file is not a Law College backup.')
        return
      }

      const result = await importData(parsed as ImportPayload)

      if (!result.ok) {
        toast.error('Nothing imported', result.message ?? 'The backup could not be read.')
        return
      }

      const counts = result.counts
      toast.success(
        'Backup restored',
        `Imported ${counts?.programs ?? 0} programs, ${counts?.applications ?? 0} applications and ${counts?.students ?? 0} students. Records with the same ID were updated.`,
      )
    } catch {
      toast.error('Invalid file', 'The selected file is not valid JSON.')
    } finally {
      setImportPending(false)
    }
  }

  const handleReset = async () => {
    setBusyData(true)
    try {
      await resetAllData()
      setResetOpen(false)
      toast.success(
        'All data cleared',
        'Programs, applications, students and documents have been removed from the database.',
      )
    } catch (error) {
      toast.error('Could not clear data', describeError(error, 'Please try again.'))
    } finally {
      setBusyData(false)
    }
  }

  const handleLoadDemo = async () => {
    setBusyData(true)
    try {
      const result = await loadDemoData()
      if (!result.ok) {
        toast.error('Sample data not loaded', result.message)
        return
      }
      setDemoOpen(false)
      toast.success(
        'Sample data loaded',
        'Sample programmes, applications and enrolled students are now available.',
      )
    } catch (error) {
      toast.error('Sample data not loaded', describeError(error, 'Please try again.'))
    } finally {
      setBusyData(false)
    }
  }

  const handleMigrate = async () => {
    setMigrating(true)
    try {
      const result = await migrateLegacyData()
      if (result.ok) toast.success('Browser data imported', result.message)
      else toast.error('Nothing imported', result.message)
    } catch (error) {
      toast.error('Import failed', describeError(error, 'The browser data could not be read.'))
    } finally {
      setMigrating(false)
    }
  }

  const recordTotal = programs.length + applications.length + students.length

  const sections: Array<{ key: Section; label: string; icon: React.ReactNode }> = [
    { key: 'account', label: 'My Account', icon: <User size={15} /> },
    ...(isAdmin ? [{ key: 'staff' as Section, label: 'Staff', icon: <Users size={15} /> }] : []),
    { key: 'data', label: 'Data', icon: <Database size={15} /> },
  ]

  return (
    <>
      <PageHeader
        title="Settings"
        description="Your account, staff access and the records held in the college database."
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
          {/* -------------------------- Account -------------------------- */}
          {section === 'account' && (
            <div className="u-stack-16">
              <Card title="Signed in as" subtitle="Your account in the college registry">
                <div className="setting-row" style={{ borderBottom: 'none', paddingBottom: 0 }}>
                  <div className="setting-row__text">
                    <p className="setting-row__title">{me?.displayName}</p>
                    <p className="setting-row__desc">
                      {me?.username} · {me ? ROLE_OPTIONS.find((r) => r.value === me.role)?.label : ''}{' '}
                      · joined {formatDate(me?.createdAt)}
                    </p>
                    <p className="setting-row__desc" style={{ marginTop: 6 }}>
                      {me ? ROLE_SUMMARY[me.role] : ''}
                    </p>
                  </div>
                  <Badge tone={me?.active ? 'active' : 'inactive'} label={me?.active ? 'Active' : 'Inactive'} />
                </div>
              </Card>

              <Card title="Password" subtitle="Your sign-in credential">
                <div className="setting-row" style={{ borderBottom: 'none', paddingBottom: 0 }}>
                  <div className="setting-row__text">
                    <p className="setting-row__title">Change your password</p>
                    <p className="setting-row__desc">
                      Stored as a one-way hash on the server — nobody, including an administrator,
                      can read it back. Use at least eight characters.
                    </p>
                  </div>
                  <Button variant="secondary" icon={<KeyRound size={14} />} onClick={openPassword}>
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

          {/* ---------------------------- Staff --------------------------- */}
          {section === 'staff' && isAdmin && (
            <div className="u-stack-16">
              <Card
                title="Staff accounts"
                subtitle="Everyone who can sign in to this portal"
                actions={
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Database size={13} />}
                    onClick={() => void refreshStaff()}
                    disabled={staffLoading}
                  >
                    {staffLoading ? 'Refreshing…' : 'Refresh'}
                  </Button>
                }
              >
                {staff.length === 0 ? (
                  <p className="u-text-subtle" style={{ fontSize: '0.8125rem' }}>
                    Loading accounts…
                  </p>
                ) : (
                  <div className="table-wrapper">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Username</th>
                          <th>Role</th>
                          <th>Status</th>
                          <th aria-label="Actions" />
                        </tr>
                      </thead>
                      <tbody>
                        {staff.map((user) => {
                          const busy = busyStaffId === user.id
                          return (
                            <tr key={user.id}>
                              <td className="table__primary">{user.displayName}</td>
                              <td className="u-mono">{user.username}</td>
                              <td>
                                <Select
                                  value={user.role}
                                  options={ROLE_OPTIONS}
                                  onChange={(event) =>
                                    void patchStaff(user, { role: event.target.value as Role })
                                  }
                                  disabled={busy}
                                  aria-label={`Role for ${user.displayName}`}
                                />
                              </td>
                              <td>
                                <Badge
                                  tone={user.active ? 'active' : 'inactive'}
                                  label={user.active ? 'Active' : 'Disabled'}
                                />
                              </td>
                              <td className="table__actions">
                                <Button
                                  size="sm"
                                  onClick={() => void patchStaff(user, { active: !user.active })}
                                  disabled={busy}
                                >
                                  {user.active ? 'Disable' : 'Enable'}
                                </Button>
                                <Button
                                  size="sm"
                                  icon={<KeyRound size={12} />}
                                  onClick={() => void resetStaffPassword(user)}
                                  disabled={busy}
                                >
                                  Reset password
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  icon={<Trash2 size={12} />}
                                  onClick={() => setRemoveTarget(user)}
                                  disabled={busy}
                                >
                                  Remove
                                </Button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                <p className="u-text-subtle" style={{ fontSize: '0.75rem', marginTop: 12, lineHeight: 1.6 }}>
                  An administrator cannot remove or demote the last active administrator, and
                  nobody can remove the account they are signed in with.
                </p>
              </Card>

              <Card title="Add a staff account" subtitle="Grant someone access to the registry">
                <form onSubmit={handleCreateStaff} noValidate>
                  <div className="form-grid form-grid--2">
                    <Input
                      label="Display Name"
                      value={newDisplayName}
                      onChange={(event) => setNewDisplayName(event.target.value)}
                      placeholder="e.g. Hafsa Khan"
                      error={staffErrors.displayName}
                      required
                    />
                    <Input
                      label="Username"
                      value={newUsername}
                      onChange={(event) => setNewUsername(event.target.value)}
                      autoComplete="off"
                      placeholder="e.g. hkhan"
                      hint="Letters, numbers, dots, dashes and underscores."
                      error={staffErrors.username}
                      required
                    />
                    <PasswordInput
                      label="Temporary Password"
                      value={newPassword2}
                      onChange={(event) => setNewPassword2(event.target.value)}
                      autoComplete="new-password"
                      hint="At least 8 characters. Ask them to change it after signing in."
                      error={staffErrors.password}
                      required
                    />
                    <Select
                      label="Role"
                      value={newRole}
                      onChange={(event) => setNewRole(event.target.value as Role)}
                      options={ROLE_OPTIONS}
                      hint={ROLE_SUMMARY[newRole]}
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
                      type="submit"
                      variant="accent"
                      icon={creatingStaff ? <Save size={14} /> : <Plus size={14} />}
                      disabled={creatingStaff}
                    >
                      {creatingStaff ? 'Creating…' : 'Create account'}
                    </Button>
                  </div>
                </form>
              </Card>
            </div>
          )}

          {/* ---------------------------- Data --------------------------- */}
          {section === 'data' && (
            <div className="u-stack-16">
              <Card title="Records" subtitle="What is currently in the database">
                <div className="setting-row">
                  <div className="setting-row__text">
                    <p className="setting-row__title">Programmes</p>
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

              {legacyCount > 0 && (
                <Card
                  title="Import from this browser"
                  subtitle="Records from the previous browser-only version"
                >
                  <Alert tone="info" icon={<HardDriveDownload size={15} />} title="One-time import">
                    {legacyCount} record{legacyCount === 1 ? '' : 's'} from the old localStorage
                    version {legacyCount === 1 ? 'is' : 'are'} still in this browser, along with any
                    documents stored in IndexedDB. Importing copies them into the database and then
                    clears the browser copy.
                  </Alert>

                  <div className="setting-row" style={{ marginTop: 4 }}>
                    <div className="setting-row__text">
                      <p className="setting-row__title">Move browser records into the database</p>
                      <p className="setting-row__desc">
                        Records are matched by ID, so anything already imported is updated rather
                        than duplicated.
                      </p>
                    </div>
                    <Button
                      variant="accent"
                      icon={<Upload size={14} />}
                      onClick={() => void handleMigrate()}
                      disabled={migrating || !canEdit}
                    >
                      {migrating ? 'Importing…' : 'Import now'}
                    </Button>
                  </div>
                </Card>
              )}

              <Card title="Backup & Restore" subtitle="Move records in and out of the database">
                <div className="setting-row">
                  <div className="setting-row__text">
                    <p className="setting-row__title">Export a backup</p>
                    <p className="setting-row__desc">
                      Downloads programmes, applications, students and the college profile as a
                      JSON file. Uploaded document files are not included.
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    icon={<Download size={14} />}
                    onClick={handleExport}
                    disabled={recordTotal === 0}
                  >
                    Export
                  </Button>
                </div>

                <div className="setting-row">
                  <div className="setting-row__text">
                    <p className="setting-row__title">Import a backup</p>
                    <p className="setting-row__desc">
                      Restores a previously exported JSON file. Records are matched by ID, so
                      re-importing the same backup will not create duplicates.
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    icon={<Upload size={14} />}
                    onClick={() => importInputRef.current?.click()}
                    disabled={importPending || !canEdit}
                  >
                    {importPending ? 'Importing…' : 'Import'}
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
                      if (file) void handleImport(file)
                    }}
                  />
                </div>

                <div className="setting-row">
                  <div className="setting-row__text">
                    <p className="setting-row__title">Load sample data</p>
                    <p className="setting-row__desc">
                      Adds a realistic demonstration set so the tables, filters and dashboard can
                      be reviewed.
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    icon={<Database size={14} />}
                    onClick={() => setDemoOpen(true)}
                    disabled={!canEdit}
                  >
                    Load sample data
                  </Button>
                </div>
              </Card>

              {isAdmin ? (
                <Card title="Danger Zone" subtitle="Irreversible actions">
                  <Alert
                    tone="danger"
                    icon={<TriangleAlert size={15} />}
                    title="Clearing all data"
                    className="no-print"
                  >
                    This deletes every programme, application, student record and uploaded document
                    from the database and restores the college profile to its defaults. Staff
                    accounts are kept, so you will stay signed in. Export a backup first if you may
                    need this information later.
                  </Alert>

                  <div className="setting-row" style={{ marginTop: 4 }}>
                    <div className="setting-row__text">
                      <p className="setting-row__title">Clear all data</p>
                      <p className="setting-row__desc">
                        Returns the academic records to a freshly installed state.
                      </p>
                    </div>
                    <Button
                      variant="danger"
                      icon={<Trash2 size={14} />}
                      onClick={() => setResetOpen(true)}
                    >
                      Clear all data
                    </Button>
                  </div>
                </Card>
              ) : (
                <Alert tone="info" icon={<ShieldCheck size={15} />}>
                  Only an administrator can clear the database or manage staff accounts.
                </Alert>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ---------------------- Change password ---------------------- */}
      <ConfirmDialog
        open={passwordOpen}
        title="Change password"
        confirmLabel={changingPassword ? 'Updating…' : 'Update password'}
        onCancel={() => setPasswordOpen(false)}
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
                error={passwordErrors.currentPassword}
                required
              />
              <PasswordInput
                label="New password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                hint="At least 8 characters."
                error={passwordErrors.newPassword}
                required
              />
              <PasswordInput
                label="Confirm new password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                error={passwordErrors.confirmPassword}
                required
              />
            </div>
          </form>
        }
      />

      {/* ------------------------- Remove staff ----------------------- */}
      <ConfirmDialog
        open={removeTarget !== null}
        title="Remove staff account"
        destructive
        confirmLabel="Remove account"
        message={
          <>
            <strong>{removeTarget?.displayName}</strong> ({removeTarget?.username}) will no longer
            be able to sign in. Applications and other records they created are unaffected.
          </>
        }
        onConfirm={handleRemoveStaff}
        onCancel={() => setRemoveTarget(null)}
      />

      {/* -------------------------- Reset data ------------------------ */}
      <ConfirmDialog
        open={resetOpen}
        title="Clear all data"
        destructive
        confirmLabel={busyData ? 'Deleting…' : 'Delete everything'}
        message={
          <>
            This permanently deletes <strong>{programs.length} programmes</strong>,{' '}
            <strong>{applications.length} applications</strong>,{' '}
            <strong>{students.length} students</strong> and all uploaded documents from the
            database. The college profile will be restored to its defaults. Staff accounts are kept.
          </>
        }
        onConfirm={handleReset}
        onCancel={() => setResetOpen(false)}
      />

      {/* ------------------------ Sample data ------------------------- */}
      <ConfirmDialog
        open={demoOpen}
        title="Load sample data"
        confirmLabel={busyData ? 'Loading…' : 'Load sample data'}
        message={
          <>
            This adds a demonstration set of programmes, applications and enrolled students, and
            fills in the college profile with example details.
            {recordTotal > 0 && (
              <>
                <br />
                <br />
                <strong>Your existing records will be kept</strong> and merged with the samples.
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

    </>
  )
}
