import { useMemo, useState } from 'react'
import {
  BookOpen,
  Clock,
  FileText,
  Pencil,
  Plus,
  Trash2,
  TriangleAlert,
  Users,
} from 'lucide-react'
import { useStore } from '@/store/StoreContext'
import {
  AdmissionStatusBadge,
  Card,
  EmptyState,
  PageHeader,
} from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, SearchInput, Select, Textarea } from '@/components/ui/Form'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import type { Program } from '@/types'

interface ProgramFormState {
  name: string
  code: string
  duration: string
  description: string
  admissionOpen: boolean
}

const EMPTY_FORM: ProgramFormState = {
  name: '',
  code: '',
  duration: '',
  description: '',
  admissionOpen: true,
}

const DURATION_OPTIONS = [
  { value: '1 Year', label: '1 Year' },
  { value: '2 Years', label: '2 Years' },
  { value: '3 Years', label: '3 Years' },
  { value: '4 Years', label: '4 Years' },
  { value: '5 Years', label: '5 Years' },
  { value: '6 Months', label: '6 Months' },
]

export function ProgramsPage() {
  const { programs, createProgram, updateProgram, deleteProgram, students, applications, canEdit } =
    useStore()
  const toast = useToast()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed'>('all')

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Program | null>(null)
  const [form, setForm] = useState<ProgramFormState>(EMPTY_FORM)
  const [errors, setErrors] = useState<Partial<Record<keyof ProgramFormState, string>>>({})

  const [deleteTarget, setDeleteTarget] = useState<Program | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()

    return programs
      .filter((program) => {
        if (statusFilter === 'open' && !program.admissionOpen) return false
        if (statusFilter === 'closed' && program.admissionOpen) return false
        if (!term) return true
        return (
          program.name.toLowerCase().includes(term) ||
          program.code.toLowerCase().includes(term) ||
          program.description.toLowerCase().includes(term)
        )
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [programs, search, statusFilter])

  /** How many students / applications currently reference a program. */
  const usageFor = (programId: string) => ({
    students: students.filter((student) => student.programId === programId).length,
    applications: applications.filter((item) => item.program.programId === programId).length,
  })

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setErrors({})
    setFormOpen(true)
  }

  const openEdit = (program: Program) => {
    setEditing(program)
    setForm({
      name: program.name,
      code: program.code,
      duration: program.duration,
      description: program.description,
      admissionOpen: program.admissionOpen,
    })
    setErrors({})
    setFormOpen(true)
  }

  const closeForm = () => {
    setFormOpen(false)
    setEditing(null)
    setErrors({})
  }

  const validate = (): boolean => {
    const next: Partial<Record<keyof ProgramFormState, string>> = {}

    if (!form.name.trim()) next.name = 'Program name is required.'
    if (!form.code.trim()) next.code = 'Program code is required.'
    if (!form.duration) next.duration = 'Select the programme duration.'

    // Programme codes must stay unique — they appear on student records.
    const duplicate = programs.some(
      (program) =>
        program.code.trim().toLowerCase() === form.code.trim().toLowerCase() &&
        program.id !== editing?.id,
    )
    if (duplicate) next.code = 'A programme with this code already exists.'

    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!validate()) return

    const payload = {
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      duration: form.duration,
      description: form.description.trim(),
      admissionOpen: form.admissionOpen,
    }

    setSaving(true)
    try {
      if (editing) {
        await updateProgram(editing.id, payload)
        toast.success('Programme updated', `${payload.name} has been saved.`)
      } else {
        await createProgram(payload)
        toast.success('Programme added', `${payload.name} is now available for admissions.`)
      }
      closeForm()
    } catch (error) {
      toast.error(
        'Could not save the programme',
        error instanceof Error ? error.message : 'An unexpected error occurred.',
      )
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    const name = deleteTarget.name
    setDeleting(true)
    try {
      await deleteProgram(deleteTarget.id)
      setDeleteTarget(null)
      toast.success('Programme deleted', `${name} has been removed.`)
    } catch (error) {
      toast.error(
        'Could not delete the programme',
        error instanceof Error ? error.message : 'An unexpected error occurred.',
      )
    } finally {
      setDeleting(false)
    }
  }

  const usage = deleteTarget ? usageFor(deleteTarget.id) : null

  return (
    <>
      <PageHeader
        title="Programs"
        description="Define the programmes offered by the college. Programmes marked open accept new admission applications."
        actions={
          canEdit ? (
            <Button variant="accent" icon={<Plus size={14} />} onClick={openCreate}>
              Add Program
            </Button>
          ) : undefined
        }
      />

      {programs.length > 0 && (
        <div className="toolbar" style={{ borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0' }}>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by name or code…"
            label="Search programs"
            className="toolbar__search"
          />
          <Select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
            options={[
              { value: 'all', label: 'All programmes' },
              { value: 'open', label: 'Admissions open' },
              { value: 'closed', label: 'Admissions closed' },
            ]}
            aria-label="Filter by admission status"
            className="desktop-only"
            style={{ width: 190 }}
          />
          <span className="toolbar__spacer" />
          <span className="toolbar__count">
            {filtered.length} of {programs.length} {programs.length === 1 ? 'programme' : 'programmes'}
          </span>
        </div>
      )}

      {programs.length === 0 ? (
        <Card flush={false}>
          <EmptyState
            icon={<BookOpen size={21} />}
            title="No programmes defined"
            message="Add the programmes offered by the college. Each programme becomes selectable on the admission form and is required before applications can be recorded."
            action={
              canEdit ? (
                <Button variant="accent" icon={<Plus size={14} />} onClick={openCreate}>
                  Add your first program
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<TriangleAlert size={21} />}
            title="No programmes match your filters"
            message="Try a different search term or reset the admission status filter."
            action={
              <Button
                onClick={() => {
                  setSearch('')
                  setStatusFilter('all')
                }}
              >
                Clear filters
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <div className="program-grid">
            {filtered.map((program) => {
              const programUsage = usageFor(program.id)

              return (
                <article className="program-card" key={program.id}>
                  <div className="program-card__head">
                    <div style={{ minWidth: 0 }}>
                      <span className="program-card__code">{program.code}</span>
                      <h3 className="program-card__name">{program.name}</h3>
                    </div>
                    <AdmissionStatusBadge open={program.admissionOpen} />
                  </div>

                  {program.description ? (
                    <p className="program-card__desc">{program.description}</p>
                  ) : (
                    <p className="program-card__desc u-text-subtle">
                      No description has been added for this programme.
                    </p>
                  )}

                  <div className="program-card__meta">
                    <span>
                      <Clock size={13} />
                      {program.duration}
                    </span>
                    <span title="Enrolled students">
                      <Users size={13} />
                      {programUsage.students} enrolled
                    </span>
                    <span title="Applications received">
                      <FileText size={13} />
                      {programUsage.applications} applications
                    </span>
                  </div>

                  {canEdit && (
                    <div className="program-card__actions">
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={<Pencil size={13} />}
                        onClick={() => openEdit(program)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Trash2 size={13} />}
                        onClick={() => setDeleteTarget(program)}
                      >
                        Delete
                      </Button>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        </>
      )}

      {/* ------------------------- Create / edit ------------------------- */}
      <Modal
        open={formOpen}
        onClose={closeForm}
        title={editing ? 'Edit Program' : 'Add Program'}
        subtitle={
          editing ? `Update the details of ${editing.name}.` : 'Define a new programme offered by the college.'
        }
        footer={
          <>
            <Button onClick={closeForm}>Cancel</Button>
            <Button variant="primary" type="submit" form="program-form" disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add program'}
            </Button>
          </>
        }
      >
        <form id="program-form" onSubmit={handleSubmit} noValidate>
          <div className="form-grid form-grid--2">
            <Input
              label="Program Name"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="e.g. Bachelor of Laws (Five Years)"
              error={errors.name}
              required
              wrapperClassName="form-grid__full"
            />

            <Input
              label="Program Code"
              value={form.code}
              onChange={(event) => setForm({ ...form, code: event.target.value })}
              placeholder="e.g. LLB-5Y"
              error={errors.code}
              hint="A short unique identifier used on student records."
              required
            />

            <Select
              label="Duration"
              value={form.duration}
              onChange={(event) => setForm({ ...form, duration: event.target.value })}
              options={DURATION_OPTIONS}
              placeholder="Select duration"
              error={errors.duration}
              required
            />

            <Textarea
              label="Description"
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              placeholder="Outline the curriculum, eligibility and areas of specialisation."
              rows={4}
              maxLength={400}
              wrapperClassName="form-grid__full"
            />

            <div className="form-grid__full">
              <div className="setting-row" style={{ paddingTop: 0 }}>
                <div className="setting-row__text">
                  <p className="setting-row__title">Admissions open</p>
                  <p className="setting-row__desc">
                    When enabled, this programme appears as a selectable option on the admission
                    form.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.admissionOpen}
                  aria-label="Admissions open"
                  className={['switch', form.admissionOpen ? 'switch--on' : ''].filter(Boolean).join(' ')}
                  onClick={() => setForm({ ...form, admissionOpen: !form.admissionOpen })}
                />
              </div>
            </div>
          </div>
        </form>
      </Modal>

      {/* ---------------------------- Delete ---------------------------- */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete programme"
        destructive
        confirmLabel={deleting ? 'Deleting…' : 'Delete programme'}
        message={
          <>
            <strong>{deleteTarget?.name}</strong> will be removed from the college. This action
            cannot be undone.
            {usage && (usage.students > 0 || usage.applications > 0) && (
              <>
                <br />
                <br />
                <span style={{ display: 'block' }}>
                  {usage.students} student{usage.students === 1 ? '' : 's'} and{' '}
                  {usage.applications} application{usage.applications === 1 ? '' : 's'} reference
                  this programme. Those records will keep their details but will show the
                  programme as removed.
                </span>
              </>
            )}
          </>
        }
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  )
}