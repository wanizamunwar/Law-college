import { useEffect, useState } from 'react'
import {
  BookOpen,
  FileCheck2,
  GraduationCap,
  Home,
  Landmark,
  User,
} from 'lucide-react'
import type { Application } from '@/types'
import { ApplicationStatusBadge } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { formatBytes, formatDate, formatDateTime, titleCase } from '@/lib/format'
import { documentObjectUrl } from '@/lib/api'

interface ApplicationDetailProps {
  application: Application
  programName: string | null
  programCode: string | null
  enrolledStudentNo?: string | null
}

interface DocumentEntry {
  label: string
  doc: Application['documents']['photograph'] | null
  isImage: boolean
}

export function ApplicationDetail({
  application,
  programName,
  programCode,
  enrolledStudentNo,
}: ApplicationDetailProps) {
  const { personal, academic, address, program, documents } = application

  const entries: DocumentEntry[] = [
    { label: 'Photograph', doc: documents.photograph, isImage: true },
    { label: 'CNIC (Copy)', doc: documents.cnic, isImage: false },
    { label: 'Academic Certificate', doc: documents.academicCertificate, isImage: false },
    { label: 'Marks Sheet', doc: documents.marksSheet, isImage: false },
  ]

  return (
    <div>
      <header className="print-header">
        <p className="print-header__name">Application Record</p>
        <p className="print-header__sub">{application.applicationNo}</p>
      </header>

      {/* Summary strip */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
          padding: '13px 15px',
          background: 'var(--surface-alt)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius)',
          marginBottom: 22,
        }}
      >
        <div>
          <p
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.0625rem',
              fontWeight: 600,
              color: 'var(--ink-900)',
            }}
          >
            {personal.fullName}
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
            {application.applicationNo} · Submitted {formatDateTime(application.createdAt)}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {enrolledStudentNo && (
            <span className="badge badge--approved">
              <GraduationCap size={11} />
              {enrolledStudentNo}
            </span>
          )}
          <ApplicationStatusBadge status={application.status} />
        </div>
      </div>

      {application.reviewNote && (
        <div className="alert alert--warning" style={{ marginBottom: 20 }}>
          <FileCheck2 size={15} className="alert__icon" />
          <div>
            <strong className="alert__title">Registry note</strong>
            {application.reviewNote}
          </div>
        </div>
      )}

      {/* Personal */}
      <DetailBlock title="Personal Information" icon={<User size={14} />}>
        <DetailGrid
          items={[
            ['Full Name', personal.fullName],
            ["Father's Name", personal.fatherName],
            ['CNIC', personal.cnic],
            ['Date of Birth', formatDate(personal.dateOfBirth)],
            ['Gender', personal.gender ? titleCase(personal.gender) : null],
            ['Phone', personal.phone],
            ['Email', personal.email],
          ]}
        />
      </DetailBlock>

      {/* Academic */}
      <DetailBlock title="Academic Information" icon={<Landmark size={14} />}>
        <DetailGrid
          items={[
            ['Previous Qualification', academic.previousQualification],
            ['Institution', academic.institution],
            ['Passing Year', academic.passingYear],
            ['Marks / Percentage', academic.marksPercentage ? `${academic.marksPercentage}%` : null],
          ]}
        />
      </DetailBlock>

      {/* Programme */}
      <DetailBlock title="Programme & Session" icon={<BookOpen size={14} />}>
        <DetailGrid
          items={[
            ['Programme', programName ?? 'Programme removed'],
            ['Programme Code', programCode],
            ['Admission Session', program.session],
          ]}
        />
      </DetailBlock>

      {/* Address */}
      <DetailBlock title="Address" icon={<Home size={14} />}>
        <DetailGrid
          items={[
            ['Current Address', address.currentAddress],
            ['Permanent Address', address.permanentAddress],
            ['City', address.city],
            ['District', address.district],
            ['Province', address.province],
            ['Postal Code', address.postalCode],
          ]}
        />
      </DetailBlock>

      {/* Documents */}
      <DetailBlock title="Documents" icon={<FileCheck2 size={14} />}>
        <div className="doc-list">
          {entries.map((entry) => (
            <DocumentItem key={entry.label} entry={entry} />
          ))}
        </div>
      </DetailBlock>
    </div>
  )
}

/* ------------------------------------------------------------------ */

function DetailBlock({
  title,
  icon,
  children,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="detail__block">
      <h3 className="detail__block-title">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  )
}

function DetailGrid({ items }: { items: Array<[string, string | null | undefined]> }) {
  return (
    <div className="detail-grid">
      {items.map(([label, value]) => (
        <div key={label}>
          <p className="detail__label">{label}</p>
          <p className="detail__value">{value || '—'}</p>
        </div>
      ))}
    </div>
  )
}

/** A single document row — previews images, opens other files on demand. */
function DocumentItem({ entry }: { entry: DocumentEntry }) {
  const { label, doc, isImage } = entry
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!doc || !isImage) return

    let url: string | null = null
    let cancelled = false

    documentObjectUrl(doc.id, doc.mimeType)
      .then((result: string | null) => {
        if (cancelled) {
          if (result) URL.revokeObjectURL(result)
          return
        }
        url = result
        setPreviewUrl(result)
      })
      .catch(() => setFailed(true))

    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [doc, isImage])

  if (!doc) {
    return (
      <div className="doc-item doc-item__missing">
        <span className="doc-item__icon">
          <FileCheck2 size={15} />
        </span>
        <span className="doc-item__meta">
          <span className="doc-item__name">{label}</span>
          <span className="doc-item__size">Not uploaded</span>
        </span>
      </div>
    )
  }

  const openDocument = async () => {
    const url = await documentObjectUrl(doc.id, doc.mimeType).catch(() => null)
    if (!url) {
      setFailed(true)
      return
    }
    window.open(url, '_blank', 'noopener,noreferrer')
    // Give the new tab time to read the blob before releasing it.
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  return (
    <div className="doc-item">
      <span className="doc-item__icon">
        {previewUrl ? (
          <img src={previewUrl} alt={label} />
        ) : (
          <FileCheck2 size={15} />
        )}
      </span>
      <span className="doc-item__meta">
        <span className="doc-item__name">{label}</span>
        <span className="doc-item__size">
          {doc.fileName} · {formatBytes(doc.size)}
          {failed ? ' · unavailable' : ''}
        </span>
      </span>
      {!failed && (
        <Button variant="ghost" size="sm" onClick={openDocument} aria-label={`Open ${label}`}>
          View
        </Button>
      )}
    </div>
  )
}