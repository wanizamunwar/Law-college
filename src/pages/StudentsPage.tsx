import { useMemo, useState } from 'react'
import {
  Eye,
  GraduationCap,
  Pencil,
  Plus,
  Trash2,
  TriangleAlert,
  UserCheck,
  X,
} from 'lucide-react'
import { useStore } from '@/store/StoreContext'
import { Card, EmptyState, PageHeader, StudentStatusBadge } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, SearchInput, Select } from '@/components/ui/Form'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import type { Student, StudentStatus } from '@/types'
import { formatDate, titleCase } from '@/lib/format'

interface StudentFormState {
  name: string
  fatherName: string
  cnic: string
  phone: string
  email: string
  programId: string
  admissionDate: string
  status: StudentStatus
}

const EMPTY_FORM: StudentFormState = {
  name: '',
  fatherName: '',
  cnic: '',
  phone: '',
  email: '',
  programId: '',
  admissionDate: new Date().toISOString().slice(0, 10),
  status: 'active',
}

const STATUS_OPTIONS: Array<{ value: StudentStatus; label: string }> = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'on-leave', label: 'On Leave' },
  { value: 'graduated', label: 'Graduated' },
]

type StatusFilter = 'all' | StudentStatus

export function StudentsPage() {
  const { students, programs, programById, createStudent, updateStudent, deleteStudent, canEdit } =
    useStore()
  const toast = useToast()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [programFilter, setProgramFilter] = useState('all')

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Student | null>(null)
  const [form, setForm] = useState<StudentFormState>(EMPTY_FORM)
  const [errors, setErrors] = useState<Partial<Record<keyof StudentFormState, string>>>({})

  const [viewTarget, setViewTarget] = useState<Student | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()

    return students
      .filter((student) => {
        if (statusFilter !== 'all' && student.status !== statusFilter) return false
        if (programFilter !== 'all' && student.programId !== programFilter) return false
        if (!term) return true
        return (
          student.studentNo.toLowerCase().includes(term) ||
          student.name.toLowerCase().includes(term) ||
          student.fatherName.toLowerCase().includes(term) ||
          student.phone.toLowerCase().includes(term)
        )
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [students, search, statusFilter, programFilter])

  const counts = useMemo(
    () => ({
      all: students.length,
      active: students.filter((item) => item.status === 'active').length,
    }),
    [students],
  )

  const openCreate = () => {
    setEditing(null)
    setForm({
      ...EMPTY_FORM,
      programId: programs[0]?.id ?? '',
    })
    setErrors({})
    setFormOpen(true)
  }

  const openEdit = (student: Student) => {
    setEditing(student)
    setForm({
      name: student.name,
      fatherName: student.fatherName,
      cnic: student.cnic,
      phone: student.phone,
      email: student.email,
      programId: student.programId,
      admissionDate: student.admissionDate,
      status: student.status,
    })
    setErrors({})
    setFormOpen(true)
  }

  const closeForm = () => {
    setFormOpen(false)
    setEditing(null)
    setErrors({})
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    const next: Partial<Record<keyof StudentFormState, string>> = {}
    if (!form.name.trim()) next.name = "Student's name is required."
    if (!form.fatherName.trim()) next.fatherName = "Father's name is required."
    if (!form.programId) next.programId = 'Select the programme.'
    if (!form.admissionDate) next.admissionDate = 'Enter the admission date.'

    setErrors(next)
    if (Object.keys(next).length > 0) return

    const payload = {
      name: form.name.trim(),
      fatherName: form.fatherName.trim(),
      cnic: form.cnic.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      programId: form.programId,
      admissionDate: form.admissionDate,
      status: form.status,
    }

    setSaving(true)
    try {
      if (editing) {
        await updateStudent(editing.id, payload)
        toast.success('Student updated', `${payload.name}'s record was saved.`)
      } else {
        await createStudent({ ...payload, applicationId: null })
        toast.success('Student added', `${payload.name} has been added to the register.`)
      }
      closeForm()
    } catch (error) {
      toast.error(
        'Could not save the student',
        error instanceof Error ? error.message : 'An unexpected error occurred.',
      )
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    const { name, studentNo, id } = deleteTarget
    setDeleting(true)
    try {
      await deleteStudent(id)
      setDeleteTarget(null)
      if (viewTarget?.id === id) setViewTarget(null)
      toast.success('Student deleted', `${studentNo} — ${name} has been removed.`)
    } catch (error) {
      toast.error(
        'Could not delete the student',
        error instanceof Error ? error.message : 'An unexpected error occurred.',
      )
    } finally {
      setDeleting(false)
    }
  }

  const resetFilters = () => {
    setSearch('')
    setStatusFilter('all')
    setProgramFilter('all')
  }

  const filtersActive =
    search.trim().length > 0 || statusFilter !== 'all' || programFilter !== 'all'

  const viewProgram = viewTarget ? programById(viewTarget.programId) : undefined

  return (
    <>
      <PageHeader
        title="Students"
        description="The official student register. Students are enrolled from approved applications or added directly."
        actions={
          canEdit ? (
            <Button
              variant="accent"
              icon={<Plus size={14} />}
              onClick={openCreate}
              disabled={programs.length === 0}
            >
              Add Student
            </Button>
          ) : undefined
        }
      />

      {programs.length === 0 && (
        <div className="alert alert--warning" style={{ marginBottom: 16 }}>
          <TriangleAlert size={16} className="alert__icon" />
          <div>
            <strong className="alert__title">No programmes available</strong>
            Students must be assigned to a programme. Define a programme before adding student
            records.
          </div>
        </div>
      )}

      <Card flush>
        <div className="toolbar">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by name, ID or phone…"
            label="Search students"
            className="toolbar__search"
          />

          <Select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            options={[
              { value: 'all', label: `All statuses (${counts.all})` },
              ...STATUS_OPTIONS.map((option) => ({
                value: option.value,
                label: `${option.label} (${
                  students.filter((student) => student.status === option.value).length
                })`,
              })),
            ]}
            aria-label="Filter by status"
            style={{ width: 168 }}
          />

          {programs.length > 0 && (
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
            Showing {filtered.length} of {students.length}
          </span>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={<GraduationCap size={21} />}
            title={
              students.length === 0 ? 'No students enrolled' : 'No students match your filters'
            }
            message={
              students.length === 0
                ? 'Approve an admission application and enrol the student, or add a student record directly.'
                : 'Adjust the search term or filters to see other students.'
            }
            action={
              students.length === 0 ? (
                canEdit ? (
                  <Button
                    variant="accent"
                    icon={<Plus size={14} />}
                    onClick={openCreate}
                    disabled={programs.length === 0}
                  >
                    Add the first student
                  </Button>
                ) : undefined
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
                  <th>Student ID</th>
                  <th>Name</th>
                  <th>Father's Name</th>
                  <th>Phone</th>
                  <th>Program</th>
                  <th>Admission Date</th>
                  <th>Status</th>
                  <th className="u-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((student) => {
                  const program = programById(student.programId)

                  return (
                    <tr key={student.id}>
                      <td>
                        <span className="table__id">{student.studentNo}</span>
                      </td>
                      <td>
                        <div className="table__primary">{student.name}</div>
                        {student.email && <div className="table__secondary">{student.email}</div>}
                      </td>
                      <td>{student.fatherName || '—'}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{student.phone || '—'}</td>
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
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {formatDate(student.admissionDate)}
                      </td>
                      <td>
                        <StudentStatusBadge status={student.status} />
                      </td>
                      <td>
                        <div className="table__actions">
                          <Button
                            variant="ghost"
                            icon={<Eye size={14} />}
                            onClick={() => setViewTarget(student)}
                            aria-label={`View ${student.studentNo}`}
                            title="View"
                          />
                          {canEdit && (
                            <>
                              <Button
                                variant="ghost"
                                icon={<Pencil size={14} />}
                                onClick={() => openEdit(student)}
                                aria-label={`Edit ${student.studentNo}`}
                                title="Edit"
                              />
                              <Button
                                variant="ghost"
                                className="btn--danger-ghost"
                                icon={<Trash2 size={14} />}
                                onClick={() => setDeleteTarget(student)}
                                aria-label={`Delete ${student.studentNo}`}
                                title="Delete"
                              />
                            </>
                          )}
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

      {/* ------------------------- Create / edit ------------------------- */}
      <Modal
        open={formOpen}
        onClose={closeForm}
        title={editing ? 'Edit Student' : 'Add Student'}
        subtitle={
          editing
            ? `Update the record for ${editing.studentNo}.`
            : 'Create a student record directly. A student ID is generated on save.'
        }
        footer={
          <>
            <Button onClick={closeForm}>Cancel</Button>
            <Button variant="primary" type="submit" form="student-form" disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add student'}
            </Button>
          </>
        }
      >
        <form id="student-form" onSubmit={handleSubmit} noValidate>
          <div className="form-grid form-grid--2">
            <Input
              label="Full Name"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="e.g. Fatima Zahra Siddiqui"
              error={errors.name}
              wrapperClassName="form-grid__full"
              required
            />
            <Input
              label="Father's Name"
              value={form.fatherName}
              onChange={(event) => setForm({ ...form, fatherName: event.target.value })}
              placeholder="e.g. Muhammad Siddiqui"
              error={errors.fatherName}
              required
            />
            <Input
              label="CNIC"
              value={form.cnic}
              onChange={(event) => setForm({ ...form, cnic: event.target.value })}
              placeholder="35202-1847536-1"
              error={errors.cnic}
            />
            <Input
              label="Phone"
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
              placeholder="03001234567"
              inputMode="tel"
            />
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              placeholder="name@example.com"
            />
            <Select
              label="Program"
              value={form.programId}
              onChange={(event) => setForm({ ...form, programId: event.target.value })}
              options={programs.map((program) => ({
                value: program.id,
                label: `${program.name} (${program.code})`,
              }))}
              placeholder="Select a program"
              error={errors.programId}
              required
            />
            <Input
              label="Admission Date"
              type="date"
              value={form.admissionDate}
              onChange={(event) => setForm({ ...form, admissionDate: event.target.value })}
              error={errors.admissionDate}
              required
            />
            <Select
              label="Status"
              value={form.status}
              onChange={(event) =>
                setForm({ ...form, status: event.target.value as StudentStatus })
              }
              options={STATUS_OPTIONS}
              wrapperClassName="form-grid__full"
            />
          </div>
        </form>
      </Modal>

      {/* ----------------------------- View ----------------------------- */}
      <Modal
        open={viewTarget !== null}
        onClose={() => setViewTarget(null)}
        title="Student Record"
        subtitle={viewTarget?.studentNo}
        footer={
          <>
            <Button onClick={() => setViewTarget(null)}>Close</Button>
            {viewTarget && (
              <Button
                variant="primary"
                icon={<Pencil size={14} />}
                onClick={() => {
                  const target = viewTarget
                  setViewTarget(null)
                  openEdit(target)
                }}
              >
                Edit student
              </Button>
            )}
          </>
        }
      >
        {viewTarget && (
          <>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '13px 15px',
                background: 'var(--surface-alt)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius)',
                marginBottom: 20,
              }}
            >
              <span className="avatar avatar--lg">{viewTarget.name.slice(0, 2).toUpperCase()}</span>
              <div style={{ minWidth: 0 }}>
                <p
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '1.0625rem',
                    fontWeight: 600,
                    color: 'var(--ink-900)',
                  }}
                >
                  {viewTarget.name}
                </p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {viewProgram?.name ?? 'Programme removed'}
                </p>
              </div>
              <div style={{ marginLeft: 'auto' }}>
                <StudentStatusBadge status={viewTarget.status} />
              </div>
            </div>

            <div className="detail-grid">
              {[
                ['Student ID', viewTarget.studentNo],
                ["Father's Name", viewTarget.fatherName],
                ['CNIC', viewTarget.cnic],
                ['Phone', viewTarget.phone],
                ['Email', viewTarget.email],
                ['Program', viewProgram?.name],
                ['Program Code', viewProgram?.code],
                ['Admission Date', formatDate(viewTarget.admissionDate)],
                ['Status', titleCase(viewTarget.status)],
                ['From Application', viewTarget.applicationId ? 'Yes' : 'Added manually'],
                ['Record Created', formatDate(viewTarget.createdAt)],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="detail__label">{label}</p>
                  <p className="detail__value">{value || '—'}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </Modal>

      {/* ---------------------------- Delete ---------------------------- */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete student record"
        destructive
        confirmLabel={deleting ? 'Deleting…' : 'Delete student'}
        message={
          <>
            <strong>{deleteTarget?.studentNo}</strong> — {deleteTarget?.name} will be permanently
            removed from the register. The original admission application, if any, is kept.
          </>
        }
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {!counts.all && (
        <p
          className="u-text-subtle"
          style={{ marginTop: 14, fontSize: '0.75rem', display: 'flex', gap: 6, alignItems: 'center' }}
        >
          <UserCheck size={13} />
          Students are created from approved applications on the Admissions page.
        </p>
      )}
    </>
  )
}