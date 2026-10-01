import { useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, Send, Save, TriangleAlert } from 'lucide-react'
import { useStore } from '@/store/StoreContext'
import { Alert, Card, FormSection, PageHeader } from '@/components/ui/Card'
import { Button, ButtonLink } from '@/components/ui/Button'
import { ChoiceGroup, Input, Select, Textarea } from '@/components/ui/Form'
import { FileUpload } from '@/components/ui/FileUpload'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import type { Application, DocumentMeta, Gender } from '@/types'
import {
  CNIC_MESSAGE,
  CNIC_PATTERN,
  EMAIL_MESSAGE,
  EMAIL_PATTERN,
  PHONE_MESSAGE,
  PHONE_PATTERN,
  POSTAL_MESSAGE,
  POSTAL_PATTERN,
  requiredNumber,
  validate,
} from '@/lib/validation'
import {
  GENDER_OPTIONS,
  PROVINCES,
  QUALIFICATION_OPTIONS,
} from '@/lib/defaults'
import { MAX_DOCUMENT_BYTES } from '@/lib/api'
import { randomId } from '@/lib/id'
import { formatBytes } from '@/lib/format'

/* ------------------------------------------------------------------ */
/* Form state                                                         */
/* ------------------------------------------------------------------ */

interface FormState extends Record<string, string> {
  fullName: string
  fatherName: string
  cnic: string
  dateOfBirth: string
  gender: Gender | ''
  phone: string
  email: string
  previousQualification: string
  institution: string
  passingYear: string
  marksPercentage: string
  programId: string
  session: string
  currentAddress: string
  permanentAddress: string
  city: string
  district: string
  province: string
  postalCode: string
}

type FormErrors = Partial<Record<keyof FormState | 'documents', string>>

const EMPTY_FORM: FormState = {
  fullName: '',
  fatherName: '',
  cnic: '',
  dateOfBirth: '',
  gender: '',
  phone: '',
  email: '',
  previousQualification: '',
  institution: '',
  passingYear: '',
  marksPercentage: '',
  programId: '',
  session: '',
  currentAddress: '',
  permanentAddress: '',
  city: '',
  district: '',
  province: '',
  postalCode: '',
}

const CURRENT_YEAR = new Date().getFullYear()

/* Documents held in memory until the form is submitted. */
interface PendingDocument {
  meta: DocumentMeta | null
  file: File | null
  existingId: string | null
}

type DocumentSlots = Record<DocumentMeta['label'], PendingDocument>

const emptySlots = (): DocumentSlots => ({
  photograph: { meta: null, file: null, existingId: null },
  cnic: { meta: null, file: null, existingId: null },
  academicCertificate: { meta: null, file: null, existingId: null },
  marksSheet: { meta: null, file: null, existingId: null },
})

/* ------------------------------------------------------------------ */

export function ApplicationFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()

  const { programs, applicationById, createApplication, updateApplication, uploadDocument, canEdit } =
    useStore()

  const readOnly = !canEdit

  const isEditing = Boolean(id)
  const existing = id ? applicationById(id) : undefined

  const [form, setForm] = useState<FormState>(() => {
    if (!existing) return EMPTY_FORM
    return {
      fullName: existing.personal.fullName,
      fatherName: existing.personal.fatherName,
      cnic: existing.personal.cnic,
      dateOfBirth: existing.personal.dateOfBirth,
      gender: existing.personal.gender,
      phone: existing.personal.phone,
      email: existing.personal.email,
      previousQualification: existing.academic.previousQualification,
      institution: existing.academic.institution,
      passingYear: existing.academic.passingYear,
      marksPercentage: existing.academic.marksPercentage,
      programId: existing.program.programId,
      session: existing.program.session,
      currentAddress: existing.address.currentAddress,
      permanentAddress: existing.address.permanentAddress,
      city: existing.address.city,
      district: existing.address.district,
      province: existing.address.province,
      postalCode: existing.address.postalCode,
    }
  })

  const [slots, setSlots] = useState<DocumentSlots>(() => {
    if (!existing) return emptySlots()
    return (Object.keys(existing.documents) as DocumentMeta['label'][]).reduce(
      (acc, label) => {
        acc[label] = { meta: existing.documents[label], file: null, existingId: null }
        return acc
      },
      emptySlots(),
    )
  })

  const [errors, setErrors] = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [savedApplication, setSavedApplication] = useState<Application | null>(null)
  const [successOpen, setSuccessOpen] = useState(false)

  const errorSummaryRef = useRef<HTMLDivElement>(null)

  const openPrograms = useMemo(
    () => programs.filter((program) => program.admissionOpen || program.id === form.programId),
    [programs, form.programId],
  )

  /* ------------------- Early exits ------------------- */

  if (isEditing && !existing) {
    return (
      <>
        <PageHeader title="Application not found" />
        <Card>
          <Alert tone="danger" icon={<TriangleAlert size={15} />} title="Record unavailable">
            This application does not exist. It may have been deleted.
          </Alert>
          <div style={{ marginTop: 16 }}>
            <ButtonLink to="/admissions" variant="primary" icon={<ArrowLeft size={14} />}>
              Back to Admissions
            </ButtonLink>
          </div>
        </Card>
      </>
    )
  }

  if (programs.length === 0) {
    return (
      <>
        <PageHeader title="New Application" />
        <Card>
          <Alert tone="warning" icon={<TriangleAlert size={15} />} title="Add a programme first">
            Every admission application must be linked to a programme. Define at least one
            programme before recording applications.
          </Alert>
          <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <ButtonLink to="/programs" variant="primary" icon={<ArrowLeft size={14} />}>
              Go to Programs
            </ButtonLink>
          </div>
        </Card>
      </>
    )
  }

  /* ------------------- Field updates ------------------- */

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    // Clear the field error as soon as the user corrects the field.
    setErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  /* ------------------- Documents ------------------- */

  const handleFileSelect = (label: DocumentMeta['label'], file: File) => {
    const meta: DocumentMeta = {
      id: randomId(),
      label,
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
      uploadedAt: new Date().toISOString(),
    }
    setSlots((prev) => ({ ...prev, [label]: { meta, file, existingId: null } }))
    setErrors((prev) => {
      if (!prev.documents) return prev
      const next = { ...prev }
      delete next.documents
      return next
    })
  }

  const handleFileClear = (label: DocumentMeta['label']) => {
    setSlots((prev) => ({ ...prev, [label]: { meta: null, file: null, existingId: null } }))
  }

  /* ------------------- Validation ------------------- */

  const validateForm = (): boolean => {
    const today = new Date()
    const birthDate = form.dateOfBirth ? new Date(form.dateOfBirth) : null
    const isUnderage =
      birthDate !== null &&
      !Number.isNaN(birthDate.getTime()) &&
      today.getFullYear() - birthDate.getFullYear() < 16

    const result = validate<FormState>(form, {
      fullName: {
        label: 'Full name',
        required: true,
        min: 3,
        max: 80,
        validate: (value) =>
          value.split(/\s+/).length < 2 ? 'Enter the full name, including first and last name.' : null,
      },
      fatherName: { label: "Father's name", required: true, min: 3, max: 80 },
      cnic: {
        label: 'CNIC',
        required: true,
        pattern: CNIC_PATTERN,
        patternMessage: CNIC_MESSAGE,
      },
      dateOfBirth: {
        label: 'Date of birth',
        required: true,
        validate: (value) => {
          const parsed = new Date(value)
          if (Number.isNaN(parsed.getTime())) return 'Enter a valid date of birth.'
          if (parsed > new Date()) return 'Date of birth cannot be in the future.'
          if (isUnderage) return 'The applicant must be at least 16 years old.'
          return null
        },
      },
      gender: { label: 'Gender', required: true },
      phone: {
        label: 'Phone',
        required: true,
        pattern: PHONE_PATTERN,
        patternMessage: PHONE_MESSAGE,
      },
      email: {
        label: 'Email',
        required: true,
        pattern: EMAIL_PATTERN,
        patternMessage: EMAIL_MESSAGE,
      },
      previousQualification: { label: 'Previous qualification', required: true },
      institution: { label: 'Institution', required: true, min: 2, max: 120 },
      passingYear: {
        label: 'Passing year',
        required: true,
        validate: (value) => {
          const year = Number(value)
          if (!Number.isInteger(year)) return 'Enter a valid year.'
          if (year < 1950 || year > CURRENT_YEAR) {
            return `Enter a year between 1950 and ${CURRENT_YEAR}.`
          }
          return null
        },
      },
      marksPercentage: {
        label: 'Marks / percentage',
        required: true,
        validate: requiredNumber('Marks / percentage', 0, 100),
      },
      programId: { label: 'Programme', required: true },
      session: {
        label: 'Admission session',
        required: true,
        validate: (value) => {
          const match = /^(\d{4})\s*-\s*(\d{4})$/.exec(value)
          if (!match) return 'Use the format 2026-2027.'
          const start = Number(match[1])
          const end = Number(match[2])
          if (end <= start) return 'The end year must be after the start year.'
          if (start < CURRENT_YEAR - 2 || start > CURRENT_YEAR + 2) {
            return `The session must begin in ${CURRENT_YEAR - 2} or later.`
          }
          return null
        },
      },
      currentAddress: { label: 'Current address', required: true, min: 5, max: 160 },
      permanentAddress: { label: 'Permanent address', required: true, min: 5, max: 160 },
      city: { label: 'City', required: true, max: 60 },
      district: { label: 'District', required: true, max: 60 },
      province: { label: 'Province', required: true },
      postalCode: {
        label: 'Postal code',
        required: true,
        pattern: POSTAL_PATTERN,
        patternMessage: POSTAL_MESSAGE,
      },
    })

    // A photograph is mandatory; other documents are strongly encouraged.
    if (!slots.photograph.meta) {
      result.documents = 'A passport-size photograph is required.'
    }

    setErrors(result)
    return Object.keys(result).length === 0
  }

  /* ------------------- Submit ------------------- */

  /**
   * The metadata set to store on the record.
   *
   * File bytes are uploaded separately, after the record exists — a document
   * id is generated up front so the metadata can be written in the same call
   * that creates the application.
   */
  const buildDocuments = (): Application['documents'] => {
    const output = {} as Application['documents']

    for (const label of Object.keys(slots) as DocumentMeta['label'][]) {
      output[label] = slots[label].meta
    }

    return output
  }

  /**
   * Uploads every newly selected file against a saved application.
   *
   * A failure here is reported but does not undo the record: the metadata is
   * already stored, so the detail view shows the file as unavailable and the
   * applicant can be asked to re-upload.
   */
  const uploadPendingFiles = async (applicationId: string): Promise<void> => {
    let failures = 0

    for (const label of Object.keys(slots) as DocumentMeta['label'][]) {
      const slot = slots[label]
      if (!slot.file || !slot.meta) continue

      try {
        await uploadDocument(applicationId, label, slot.file)
      } catch {
        failures += 1
      }
    }

    if (failures > 0) {
      toast.warning(
        'Some documents were not saved',
        `${failures} file${failures === 1 ? '' : 's'} could not be uploaded. The record was saved — re-open it to try again.`,
      )
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!validateForm()) {
      // Move focus to the summary so the user sees what needs attention.
      window.requestAnimationFrame(() => {
        errorSummaryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        errorSummaryRef.current?.focus()
      })
      return
    }

    setSubmitting(true)

    try {
      const payload = {
        personal: {
          fullName: form.fullName.trim(),
          fatherName: form.fatherName.trim(),
          cnic: form.cnic.trim(),
          dateOfBirth: form.dateOfBirth,
          gender: form.gender as Gender,
          phone: form.phone.trim(),
          email: form.email.trim(),
        },
        academic: {
          previousQualification: form.previousQualification,
          institution: form.institution.trim(),
          passingYear: form.passingYear.trim(),
          marksPercentage: form.marksPercentage.trim(),
        },
        program: { programId: form.programId, session: form.session.trim() },
        address: {
          currentAddress: form.currentAddress.trim(),
          permanentAddress: form.permanentAddress.trim(),
          city: form.city.trim(),
          district: form.district.trim(),
          province: form.province,
          postalCode: form.postalCode.trim(),
        },
        documents: buildDocuments(),
      }

      if (existing) {
        await updateApplication(existing.id, payload)
        await uploadPendingFiles(existing.id)
        toast.success('Application updated', `${payload.personal.fullName}'s record was saved.`)
        navigate('/admissions')
        return
      }

      const created = await createApplication(payload)
      await uploadPendingFiles(created.id)
      setSavedApplication(created)
      setSuccessOpen(true)
      toast.success('Application submitted', `ID ${created.applicationNo} has been assigned.`)
    } catch (error) {
      toast.error(
        'Could not save application',
        error instanceof Error ? error.message : 'An unexpected error occurred.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const errorList = Object.entries(errors).filter(
    ([key, value]) => Boolean(value) && key !== 'documents',
  ) as Array<[keyof FormState, string]>

  const documentLabels: Record<DocumentMeta['label'], { label: string; accept: string }> = {
    photograph: { label: 'Photograph', accept: 'image/png,image/jpeg,image/webp' },
    cnic: { label: 'CNIC Copy', accept: 'image/png,image/jpeg,image/webp,application/pdf' },
    academicCertificate: {
      label: 'Academic Certificate',
      accept: 'image/png,image/jpeg,image/webp,application/pdf',
    },
    marksSheet: { label: 'Marks Sheet', accept: 'image/png,image/jpeg,image/webp,application/pdf' },
  }

  const defaultSession = `${CURRENT_YEAR}-${CURRENT_YEAR + 1}`

  return (
    <>
      <PageHeader
        title={isEditing ? 'Edit Application' : 'New Application'}
        description={
          isEditing
            ? `Editing ${existing?.applicationNo}. Changes are saved to the existing record.`
            : 'Complete all sections below. Required fields are marked with an asterisk.'
        }
        actions={
          <Button
            variant="secondary"
            icon={<ArrowLeft size={14} />}
            onClick={() => navigate('/admissions')}
          >
            Back to Admissions
          </Button>
        }
      />

      <form onSubmit={handleSubmit} noValidate>
        {readOnly && (
          <div style={{ marginBottom: 16 }}>
            <Alert
              tone="info"
              icon={<TriangleAlert size={15} />}
              title="Read-only access"
            >
              Your account can view applications but cannot create or change them. Ask an
              administrator for a registrar or admin role to record applications.
            </Alert>
          </div>
        )}

        {errorList.length > 0 && (
          <div ref={errorSummaryRef} tabIndex={-1} style={{ marginBottom: 16 }}>
            <Alert
              tone="danger"
              icon={<TriangleAlert size={15} />}
              title={`${errorList.length + (errors.documents ? 1 : 0)} field${
                errorList.length + (errors.documents ? 1 : 0) === 1 ? '' : 's'
              } need attention`}
            >
              Please correct the highlighted fields below and submit again.
            </Alert>
          </div>
        )}

        <div className="u-stack-16">
          <Card title="Applicant Details" subtitle="Section 1 of 4">
            <FormSection step={1} title="Personal Information">
              <div className="form-grid form-grid--2">
                <Input
                  label="Full Name"
                  value={form.fullName}
                  onChange={(event) => set('fullName', event.target.value)}
                  placeholder="e.g. Fatima Zahra Siddiqui"
                  autoComplete="name"
                  error={errors.fullName}
                  required
                />
                <Input
                  label="Father's Name"
                  value={form.fatherName}
                  onChange={(event) => set('fatherName', event.target.value)}
                  placeholder="e.g. Muhammad Siddiqui"
                  autoComplete="additional-name"
                  error={errors.fatherName}
                  required
                />
                <Input
                  label="CNIC"
                  value={form.cnic}
                  onChange={(event) => set('cnic', event.target.value)}
                  placeholder="35202-1847536-1"
                  inputMode="numeric"
                  error={errors.cnic}
                  hint="Format: 00000-0000000-0"
                  required
                />
                <Input
                  label="Date of Birth"
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(event) => set('dateOfBirth', event.target.value)}
                  max={`${CURRENT_YEAR}-12-31`}
                  error={errors.dateOfBirth}
                  required
                />

                <ChoiceGroup
                  label="Gender"
                  value={form.gender}
                  options={GENDER_OPTIONS}
                  onChange={(value) => set('gender', value)}
                  error={errors.gender}
                  required
                />

                <Input
                  label="Phone"
                  value={form.phone}
                  onChange={(event) => set('phone', event.target.value)}
                  placeholder="03001234567"
                  inputMode="tel"
                  autoComplete="tel"
                  error={errors.phone}
                  required
                />

                <Input
                  label="Email"
                  type="email"
                  value={form.email}
                  onChange={(event) => set('email', event.target.value)}
                  placeholder="name@example.com"
                  autoComplete="email"
                  error={errors.email}
                  wrapperClassName="form-grid__full"
                  required
                />
              </div>
            </FormSection>
          </Card>

          <Card title="Academic Record" subtitle="Section 2 of 4">
            <FormSection step={2} title="Academic Information">
              <div className="form-grid form-grid--2">
                <Select
                  label="Previous Qualification"
                  value={form.previousQualification}
                  onChange={(event) => set('previousQualification', event.target.value)}
                  options={QUALIFICATION_OPTIONS.map((item) => ({ value: item, label: item }))}
                  placeholder="Select qualification"
                  error={errors.previousQualification}
                  required
                />
                <Input
                  label="Institution"
                  value={form.institution}
                  onChange={(event) => set('institution', event.target.value)}
                  placeholder="e.g. Government College for Women, Lahore"
                  error={errors.institution}
                  required
                />
                <Input
                  label="Passing Year"
                  value={form.passingYear}
                  onChange={(event) => set('passingYear', event.target.value)}
                  placeholder="2024"
                  inputMode="numeric"
                  error={errors.passingYear}
                  required
                />
                <Input
                  label="Marks / Percentage"
                  value={form.marksPercentage}
                  onChange={(event) => set('marksPercentage', event.target.value)}
                  placeholder="87.5"
                  hint="Enter a number between 0 and 100."
                  inputMode="decimal"
                  error={errors.marksPercentage}
                  required
                />
              </div>
            </FormSection>
          </Card>

          <Card title="Programme Selection" subtitle="Section 3 of 4">
            <FormSection step={3} title="Program">
              <div className="form-grid form-grid--2">
                <Select
                  label="Select Program"
                  value={form.programId}
                  onChange={(event) => set('programId', event.target.value)}
                  options={openPrograms.map((program) => ({
                    value: program.id,
                    label: `${program.name} (${program.code})`,
                  }))}
                  placeholder="Select a program"
                  error={errors.programId}
                  hint={
                    openPrograms.length === 0
                      ? 'No programme currently accepts admissions.'
                      : undefined
                  }
                  required
                />
                <Input
                  label="Admission Session"
                  value={form.session}
                  onChange={(event) => set('session', event.target.value)}
                  placeholder={defaultSession}
                  error={errors.session}
                  hint="Format: 2026-2027"
                  required
                />
              </div>
            </FormSection>
          </Card>

          <Card title="Address Details" subtitle="Section 4 of 4">
            <FormSection step={4} title="Address">
              <div className="form-grid form-grid--2">
                <Textarea
                  label="Current Address"
                  value={form.currentAddress}
                  onChange={(event) => set('currentAddress', event.target.value)}
                  placeholder="House / street / area"
                  rows={2}
                  error={errors.currentAddress}
                  wrapperClassName="form-grid__full"
                  required
                />
                <Textarea
                  label="Permanent Address"
                  value={form.permanentAddress}
                  onChange={(event) => set('permanentAddress', event.target.value)}
                  placeholder="House / street / area"
                  rows={2}
                  error={errors.permanentAddress}
                  wrapperClassName="form-grid__full"
                  required
                />
                <Input
                  label="City"
                  value={form.city}
                  onChange={(event) => set('city', event.target.value)}
                  placeholder="e.g. Lahore"
                  autoComplete="address-level2"
                  error={errors.city}
                  required
                />
                <Input
                  label="District"
                  value={form.district}
                  onChange={(event) => set('district', event.target.value)}
                  placeholder="e.g. Lahore"
                  autoComplete="address-level3"
                  error={errors.district}
                  required
                />
                <Select
                  label="Province"
                  value={form.province}
                  onChange={(event) => set('province', event.target.value)}
                  options={PROVINCES.map((item) => ({ value: item, label: item }))}
                  placeholder="Select province"
                  error={errors.province}
                  required
                />
                <Input
                  label="Postal Code"
                  value={form.postalCode}
                  onChange={(event) => set('postalCode', event.target.value)}
                  placeholder="54000"
                  inputMode="numeric"
                  error={errors.postalCode}
                  required
                />
              </div>
            </FormSection>
          </Card>

          <Card title="Supporting Documents" subtitle="Optional, except the photograph">
            <div className="form-grid form-grid--2">
              {(Object.keys(documentLabels) as DocumentMeta['label'][]).map((label) => {
                const config = documentLabels[label]
                const slot = slots[label]

                return (
                  <FileUpload
                    key={label}
                    label={config.label}
                    accept={config.accept}
                    required={label === 'photograph'}
                    fileName={slot.meta?.fileName ?? null}
                    fileSize={slot.meta?.size ?? null}
                    error={label === 'photograph' ? errors.documents : undefined}
                    onSelect={(file) => handleFileSelect(label, file)}
                    onClear={() => handleFileClear(label)}
                  />
                )
              })}
            </div>

            <p className="u-text-subtle" style={{ marginTop: 14, fontSize: '0.75rem' }}>
              Accepted formats: JPG, PNG, WEBP and PDF · Maximum{' '}
              {formatBytes(MAX_DOCUMENT_BYTES)} per file. Files are uploaded to the college
              database and stored with the application.
            </p>
          </Card>

          <div className="form-actions" style={{ borderRadius: 'var(--radius-lg)' }}>
            <span className="form-actions__note">
              <Check size={13} />
              {isEditing
                ? `Editing ${existing?.applicationNo}`
                : 'A unique application ID is generated on submit'}
            </span>
            <Button
              variant="secondary"
              onClick={() => navigate('/admissions')}
              disabled={submitting}
            >
              {readOnly ? 'Back' : 'Cancel'}
            </Button>
            <Button
              type="submit"
              variant="accent"
              icon={isEditing ? <Save size={14} /> : <Send size={14} />}
              disabled={submitting || readOnly}
            >
              {submitting
                ? 'Saving…'
                : readOnly
                  ? 'Read-only'
                  : isEditing
                    ? 'Save changes'
                    : 'Submit application'}
            </Button>
          </div>
        </div>
      </form>

      {/* ---------------------- Success dialog ---------------------- */}
      <Modal
        open={successOpen}
        onClose={() => setSuccessOpen(false)}
        title="Application submitted"
        size="sm"
        footer={
          <>
            <Button
              onClick={() => {
                setSuccessOpen(false)
                navigate('/admissions')
              }}
            >
              View all applications
            </Button>
            <Button
              variant="primary"
              icon={<Send size={14} />}
              onClick={() => {
                setSuccessOpen(false)
                setForm(EMPTY_FORM)
                setSlots(emptySlots())
                setErrors({})
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
            >
              Record another
            </Button>
          </>
        }
      >
        <div style={{ textAlign: 'center', padding: '6px 0 2px' }}>
          <span
            style={{
              width: 46,
              height: 46,
              borderRadius: '50%',
              background: 'var(--success-bg)',
              color: 'var(--success)',
              display: 'grid',
              placeItems: 'center',
              margin: '0 auto 14px',
            }}
          >
            <Check size={22} />
          </span>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            The application for{' '}
            <strong style={{ color: 'var(--ink-900)' }}>{form.fullName}</strong> has been
            recorded successfully.
          </p>

          <div
            style={{
              marginTop: 16,
              padding: '13px 15px',
              background: 'var(--paper)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius)',
            }}
          >
            <p className="detail__label" style={{ marginBottom: 4 }}>
              Application ID
            </p>
            <p
              className="u-mono"
              style={{ fontSize: '1.0625rem', fontWeight: 600, color: 'var(--ink-900)' }}
            >
              {savedApplication?.applicationNo}
            </p>
          </div>

          <p className="u-text-subtle" style={{ fontSize: '0.75rem', marginTop: 12 }}>
            Keep this reference for future correspondence. The application is currently pending
            review.
          </p>
        </div>
      </Modal>
    </>
  )
}