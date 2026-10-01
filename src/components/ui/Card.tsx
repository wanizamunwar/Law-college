import type { ReactNode } from 'react'
import type { ApplicationStatus, StudentStatus } from '@/types'
import { titleCase } from '@/lib/format'

type Tone = 'pending' | 'approved' | 'rejected' | 'neutral' | 'active' | 'inactive' | 'graduated' | 'on-leave' | 'open' | 'closed'

const TONE_STYLES: Record<Tone, { className: string; label: string }> = {
  pending: { className: 'badge--pending', label: 'Pending' },
  approved: { className: 'badge--approved', label: 'Approved' },
  rejected: { className: 'badge--rejected', label: 'Rejected' },
  neutral: { className: 'badge--neutral', label: '—' },
  active: { className: 'badge--active', label: 'Active' },
  inactive: { className: 'badge--inactive', label: 'Inactive' },
  graduated: { className: 'badge--graduated', label: 'Graduated' },
  'on-leave': { className: 'badge--on-leave', label: 'On Leave' },
  open: { className: 'badge--open', label: 'Open' },
  closed: { className: 'badge--closed', label: 'Closed' },
}

interface BadgeProps {
  tone: Tone
  label?: string
  withDot?: boolean
}

export function Badge({ tone, label, withDot = true }: BadgeProps) {
  const style = TONE_STYLES[tone]
  return (
    <span className={`badge ${style.className}`}>
      {withDot && <span className="badge__dot" aria-hidden="true" />}
      {label ?? style.label}
    </span>
  )
}

const APPLICATION_TONE: Record<ApplicationStatus, Tone> = {
  pending: 'pending',
  approved: 'approved',
  rejected: 'rejected',
}

const STUDENT_TONE: Record<StudentStatus, Tone> = {
  active: 'active',
  inactive: 'inactive',
  graduated: 'graduated',
  'on-leave': 'on-leave',
}

export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  return <Badge tone={APPLICATION_TONE[status]} />
}

export function StudentStatusBadge({ status }: { status: StudentStatus }) {
  return <Badge tone={STUDENT_TONE[status]} label={titleCase(status)} />
}

export function AdmissionStatusBadge({ open }: { open: boolean }) {
  return <Badge tone={open ? 'open' : 'closed'} label={open ? 'Open' : 'Closed'} />
}

/* ------------------------------------------------------------------ */
/* Card                                                               */
/* ------------------------------------------------------------------ */

interface CardProps {
  title?: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
  flush?: boolean
  className?: string
}

export function Card({ title, subtitle, actions, children, flush, className }: CardProps) {
  return (
    <section className={['card', className].filter(Boolean).join(' ')}>
      {(title || actions) && (
        <header className="card__header">
          <div>
            {title && <h2 className="card__title">{title}</h2>}
            {subtitle && <p className="card__subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="page__actions">{actions}</div>}
        </header>
      )}
      <div className={['card__body', flush ? 'card__body--flush' : ''].filter(Boolean).join(' ')}>
        {children}
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Page header                                                        */
/* ------------------------------------------------------------------ */

interface PageHeaderProps {
  title: string
  description?: string
  actions?: ReactNode
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header className="page__header">
      <div>
        <h1 className="page__title">{title}</h1>
        {description && <p className="page__description">{description}</p>}
      </div>
      {actions && <div className="page__actions">{actions}</div>}
    </header>
  )
}

/* ------------------------------------------------------------------ */
/* Empty state                                                        */
/* ------------------------------------------------------------------ */

interface EmptyStateProps {
  icon: ReactNode
  title: string
  message: string
  action?: ReactNode
}

export function EmptyState({ icon, title, message, action }: EmptyStateProps) {
  return (
    <div className="empty">
      <div className="empty__icon">{icon}</div>
      <h3 className="empty__title">{title}</h3>
      <p className="empty__text">{message}</p>
      {action}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Alert                                                              */
/* ------------------------------------------------------------------ */

interface AlertProps {
  tone?: 'info' | 'success' | 'warning' | 'danger'
  title?: string
  children: ReactNode
  icon?: ReactNode
  className?: string
}

export function Alert({ tone = 'info', title, children, icon, className }: AlertProps) {
  return (
    <div className={['alert', `alert--${tone}`, className].filter(Boolean).join(' ')}>
      {icon && <span className="alert__icon">{icon}</span>}
      <div>
        {title && <strong className="alert__title">{title}</strong>}
        <div>{children}</div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Section fieldset wrapper (admission form)                          */
/* ------------------------------------------------------------------ */

interface SectionProps {
  step: number
  title: string
  children: ReactNode
}

export function FormSection({ step, title, children }: SectionProps) {
  return (
    <fieldset className="fieldset">
      <div className="fieldset__header">
        <span className="fieldset__number" aria-hidden="true">
          {step}
        </span>
        <legend className="fieldset__title">{title}</legend>
      </div>
      {children}
    </fieldset>
  )
}