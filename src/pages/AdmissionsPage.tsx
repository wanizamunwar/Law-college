import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Check,
  Eye,
  GraduationCap,
  Pencil,
  Plus,
  ScrollText,
  Trash2,
  TriangleAlert,
  X,
} from 'lucide-react'
import { useStore } from '@/store/StoreContext'
import {
  ApplicationStatusBadge,
  Card,
  EmptyState,
  PageHeader,
} from '@/components/ui/Card'
import { Button, ButtonLink } from '@/components/ui/Button'
import { SearchInput, Select } from '@/components/ui/Form'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import { ApplicationDetail } from '@/components/applications/ApplicationDetail'
import type { Application, ApplicationStatus } from '@/types'
import { formatDate } from '@/lib/format'

type StatusFilter = 'all' | ApplicationStatus

export function AdmissionsPage() {
  const { applications, programs, programById, setApplicationStatus, deleteApplication, students, promoteToStudent } =
    useStore()
  const toast = useToast()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => {
    const param = searchParams.get('status')
    return param === 'pending' || param === 'approved' || param === 'rejected' ? param : 'all'
  })
  const [programFilter, setProgramFilter] = useState('all')

  const [viewTarget, setViewTarget] = useState<Application | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Application | null>(null)
  const [rejectTarget, setRejectTarget] = useState<Application | null>(null)
  const [rejectNote, setRejectNote] = useState('')

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()

    return applications
      .filter((application) => {
        if (statusFilter !== 'all' && application.status !== statusFilter) return false
        if (programFilter !== 'all' && application.program.programId !== programFilter) return false
        if (!term) return true

        const program = programById(application.program.programId)
        return (
          application.applicationNo.toLowerCase().includes(term) ||
          application.personal.fullName.toLowerCase().includes(term) ||
          application.personal.fatherName.toLowerCase().includes(term) ||
          application.personal.cnic.toLowerCase().includes(term) ||
          application.personal.phone.toLowerCase().includes(term) ||
          (program?.name.toLowerCase().includes(term) ?? false)
        )
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [applications, search, statusFilter, programFilter, programById])

  const counts = useMemo(
    () => ({
      all: applications.length,
      pending: applications.filter((item) => item.status === 'pending').length,
      approved: applications.filter((item) => item.status === 'approved').length,
      rejected: applications.filter((item) => item.status === 'rejected').length,
    }),
    [applications],
  )

  const hasPrograms = programs.length > 0

  const handleApprove = (application: Application) => {
    setApplicationStatus(application.id, 'approved')
    toast.success('Application approved', `${application.personal.fullName} has been approved.`)
  }

  const openReject = (application: Application) => {
    setRejectTarget(application)
    setRejectNote(application.reviewNote ?? '')
  }

  const confirmReject = () => {
    if (!rejectTarget) return
    setApplicationStatus(rejectTarget.id, 'rejected', rejectNote.trim() || undefined)
    toast.success('Application rejected', `${rejectTarget.personal.fullName} has been rejected.`)
    setRejectTarget(null)
    setRejectNote('')
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    const name = deleteTarget.personal.fullName
    const id = deleteTarget.applicationNo
    deleteApplication(deleteTarget.id)
    setDeleteTarget(null)
    if (viewTarget?.id === deleteTarget.id) setViewTarget(null)
    toast.success('Application deleted', `${id} — ${name} has been removed.`)
  }

  const handleEnroll = (application: Application) => {
    const result = promoteToStudent(application.id)
    if (result.ok && result.student) {
      toast.success(
        'Student enrolled',
        `${result.student.name} has been added as ${result.student.studentNo}.`,
      )
    } else if (result.student) {
      toast.warning('Already enrolled', result.message)
    } else {
      toast.error('Could not enrol', result.message)
    }
  }

  const resetFilters = () => {
    setSearch('')
    setStatusFilter('all')
    setProgramFilter('all')
  }

  const filtersActive =
    search.trim().length > 0 || statusFilter !== 'all' || programFilter !== 'all'

  return (
    <>
      <PageHeader
        title="Admissions"
        description="Review, decide and record every admission application submitted to the college."
        actions={
          <>
            <Button
              variant="secondary"
              icon={<GraduationCap size={14} />}
              onClick={() => navigate('/students')}
            >
              Student Register
            </Button>
            <ButtonLink to="/admissions/new" variant="accent" icon={<Plus size={14} />}>
              New Application
            </ButtonLink>
          </>
        }
      />

      {!hasPrograms && (
        <div className="alert alert--warning" style={{ marginBottom: 16 }}>
          <TriangleAlert size={16} className="alert__icon" />
          <div>
            <strong className="alert__title">No programmes have been defined</strong>
            Applications require a programme. Add at least one programme before recording
            applications.
          </div>
        </div>
      )}

      <Card flush>
        <div className="toolbar">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by name, application ID or CNIC…"
            label="Search applications"
            className="toolbar__search"
          />

          <Select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            options={[
              { value: 'all', label: `All statuses (${counts.all})` },
              { value: 'pending', label: `Pending (${counts.pending})` },
              { value: 'approved', label: `Approved (${counts.approved})` },
              { value: 'rejected', label: `Rejected (${counts.rejected})` },
            ]}
            aria-label="Filter by status"
            style={{ width: 168 }}
          />

          {hasPrograms && (
            <Select
              value={programFilter}
              onChange={(event) => setProgramFilter(event.target.value)}
              options={[
                { value: 'all', label: 'All programs' },
                ...programs.map((program) => ({ value: program.id, label: program.name })),
              ]}
              aria-label="Filter by program"
              style={{ width: 210, maxWidth: 230 }}
            />
          )}

          {filtersActive && (
            <Button variant="ghost" size="sm" icon={<X size={13} />} onClick={resetFilters}>
              Reset
            </Button>
          )}

          <span className="toolbar__spacer" />
          <span className="toolbar__count">
            Showing {filtered.length} of {applications.length}
          </span>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={<ScrollText size={21} />}
            title={
              applications.length === 0
                ? 'No applications received'
                : 'No applications match your filters'
            }
            message={
              applications.length === 0
                ? 'Record the first admission application using the guided form. Every submission is assigned a unique application ID.'
                : 'Adjust the search term or status filter to see other applications.'
            }
            action={
              applications.length === 0 ? (
                <ButtonLink
                  to="/admissions/new"
                  variant="accent"
                  icon={<Plus size={14} />}
                >
                  New Application
                </ButtonLink>
              ) : (
                <Button onClick={resetFilters}>Clear filters</Button>
              )
            }
          />
        ) : (
          <div className="table-wrapper">
            <table className="table table--fixed-actions">
              <thead>
                <tr>
                  <th>Application ID</th>
                  <th>Student Name</th>
                  <th>Program</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th className="u-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((application) => {
                  const program = programById(application.program.programId)
                  const enrolled = students.some(
                    (student) => student.applicationId === application.id,
                  )

                  return (
                    <tr key={application.id}>
                      <td>
                        <span className="table__id">{application.applicationNo}</span>
                      </td>
                      <td>
                        <div className="table__primary">
                          {application.personal.fullName}
                        </div>
                        <div className="table__secondary">
                          {application.address.city || '—'} ·{' '}
                          {application.program.session || 'No session'}
                        </div>
                      </td>
                      <td>
                        {program ? (
                          <>
                            <div>{program.name}</div>
                            <div className="table__secondary">{program.code}</div>
                          </>
                        ) : (
                          <span className="u-text-subtle">Programme removed</span>
                        )}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>{formatDate(application.createdAt)}</td>
                      <td>
                        <ApplicationStatusBadge status={application.status} />
                      </td>
                      <td>
                        <div className="table__actions">
                          <Button
                            variant="ghost"
                            icon={<Eye size={14} />}
                            onClick={() => setViewTarget(application)}
                            aria-label={`View ${application.applicationNo}`}
                            title="View"
                          />

                          <Button
                            variant="ghost"
                            icon={<Pencil size={14} />}
                            onClick={() => navigate(`/admissions/${application.id}/edit`)}
                            aria-label={`Edit ${application.applicationNo}`}
                            title="Edit"
                          />

                          {application.status !== 'approved' && (
                            <Button
                              variant="ghost"
                              icon={<Check size={14} />}
                              onClick={() => handleApprove(application)}
                              aria-label={`Approve ${application.applicationNo}`}
                              title="Approve"
                            />
                          )}

                          {application.status !== 'rejected' && (
                            <Button
                              variant="ghost"
                              icon={<X size={14} />}
                              onClick={() => openReject(application)}
                              aria-label={`Reject ${application.applicationNo}`}
                              title="Reject"
                            />
                          )}

                          {application.status === 'approved' && !enrolled && (
                            <Button
                              variant="ghost"
                              icon={<GraduationCap size={14} />}
                              onClick={() => handleEnroll(application)}
                              aria-label={`Enrol ${application.personal.fullName}`}
                              title="Enrol as student"
                            />
                          )}

                          <Button
                            variant="ghost"
                            className="btn--danger-ghost"
                            icon={<Trash2 size={14} />}
                            onClick={() => setDeleteTarget(application)}
                            aria-label={`Delete ${application.applicationNo}`}
                            title="Delete"
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ---------------------------- View ---------------------------- */}
      <Modal
        open={viewTarget !== null}
        onClose={() => setViewTarget(null)}
        title="Application Details"
        subtitle={viewTarget?.applicationNo}
        size="xl"
        footer={
          <>
            <Button onClick={() => setViewTarget(null)}>Close</Button>
            {viewTarget && (
              <Button
                variant="primary"
                icon={<Pencil size={14} />}
                onClick={() => {
                  const id = viewTarget.id
                  setViewTarget(null)
                  navigate(`/admissions/${id}/edit`)
                }}
              >
                Edit application
              </Button>
            )}
          </>
        }
      >
        {viewTarget && (
          <ApplicationDetail
            application={viewTarget}
            programName={programById(viewTarget.program.programId)?.name ?? null}
            programCode={programById(viewTarget.program.programId)?.code ?? null}
            enrolledStudentNo={
              students.find((student) => student.applicationId === viewTarget.id)?.studentNo ?? null
            }
          />
        )}
      </Modal>

      {/* --------------------------- Reject --------------------------- */}
      <Modal
        open={rejectTarget !== null}
        onClose={() => setRejectTarget(null)}
        title="Reject application"
        subtitle={rejectTarget ? `${rejectTarget.applicationNo} · ${rejectTarget.personal.fullName}` : ''}
        size="sm"
        footer={
          <>
            <Button onClick={() => setRejectTarget(null)}>Cancel</Button>
            <Button variant="danger" icon={<X size={14} />} onClick={confirmReject}>
              Reject application
            </Button>
          </>
        }
      >
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 14 }}>
          The applicant will be marked as rejected. You may record an internal note for the
          registry — it is not shown to the applicant.
        </p>
        <div className="field">
          <label className="field__label" htmlFor="reject-note">
            Internal note (optional)
          </label>
          <textarea
            id="reject-note"
            className="textarea"
            rows={3}
            value={rejectNote}
            onChange={(event) => setRejectNote(event.target.value)}
            placeholder="e.g. Did not meet the minimum aggregate requirement."
            maxLength={300}
          />
        </div>
      </Modal>

      {/* --------------------------- Delete --------------------------- */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete application"
        destructive
        confirmLabel="Delete application"
        message={
          <>
            <strong>{deleteTarget?.applicationNo}</strong> —{' '}
            {deleteTarget?.personal.fullName} will be permanently deleted, including all uploaded
            documents. This cannot be undone.
          </>
        }
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  )
}