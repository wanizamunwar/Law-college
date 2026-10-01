import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  FileClock,
  GraduationCap,
  Plus,
  UserCheck,
} from 'lucide-react'
import { useStore } from '@/store/StoreContext'
import { Card, EmptyState, PageHeader, ApplicationStatusBadge } from '@/components/ui/Card'
import { Button, ButtonLink } from '@/components/ui/Button'
import { formatDate, relativeTime } from '@/lib/format'

export function DashboardPage() {
  const { applications, students, programs, programById, settings } = useStore()
  const navigate = useNavigate()

  const stats = useMemo(() => {
    const now = Date.now()
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000

    const pending = applications.filter((item) => item.status === 'pending')
    const approved = applications.filter((item) => item.status === 'approved')
    const rejected = applications.filter((item) => item.status === 'rejected')
    const newThisWeek = applications.filter(
      (item) => new Date(item.createdAt).getTime() >= sevenDaysAgo,
    )
    const openPrograms = programs.filter((program) => program.admissionOpen)

    return {
      totalStudents: students.length,
      activeStudents: students.filter((item) => item.status === 'active').length,
      newApplications: newThisWeek.length,
      totalApplications: applications.length,
      pending: pending.length,
      approved: approved.length,
      rejected: rejected.length,
      programs: programs.length,
      openPrograms: openPrograms.length,
    }
  }, [applications, students, programs])

  const recentApplications = useMemo(
    () =>
      [...applications]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 8),
    [applications],
  )

  const statsGrid = [
    {
      label: 'Total Students',
      value: stats.totalStudents,
      meta: `${stats.activeStudents} currently active`,
      icon: <GraduationCap size={16} />,
      tone: 'info' as const,
      to: '/students',
    },
    {
      label: 'New Applications',
      value: stats.newApplications,
      meta: `Received in the last 7 days`,
      icon: <ClipboardList size={16} />,
      tone: 'brass' as const,
      to: '/admissions',
    },
    {
      label: 'Pending Applications',
      value: stats.pending,
      meta: `Awaiting a decision`,
      icon: <FileClock size={16} />,
      tone: 'warning' as const,
      to: '/admissions?status=pending',
    },
    {
      label: 'Approved Applications',
      value: stats.approved,
      meta: `${stats.rejected} rejected`,
      icon: <UserCheck size={16} />,
      tone: 'success' as const,
      to: '/admissions?status=approved',
    },
    {
      label: 'Programs',
      value: stats.programs,
      meta: `${stats.openPrograms} accepting admissions`,
      icon: <BookOpen size={16} />,
      tone: 'info' as const,
      to: '/programs',
    },
  ]

  const firstName = settings.college.name || 'Law College'

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Admissions and enrolment overview for ${firstName}.`}
        actions={
          <>
            <ButtonLink to="/programs" variant="secondary" icon={<BookOpen size={14} />}>
              Manage Programs
            </ButtonLink>
            <ButtonLink
              to="/admissions/new"
              variant="accent"
              icon={<Plus size={14} />}
            >
              New Application
            </ButtonLink>
          </>
        }
      />

      <div className="stat-grid">
        {statsGrid.map((stat) => (
          <Link
            key={stat.label}
            to={stat.to}
            className={`stat stat--${stat.tone}`}
            style={{ textDecoration: 'none' }}
          >
            <div className="stat__head">
              <span className="stat__label">{stat.label}</span>
              <span className="stat__icon">{stat.icon}</span>
            </div>
            <div className="stat__value">{stat.value}</div>
            <div className="stat__meta">{stat.meta}</div>
          </Link>
        ))}
      </div>

      <div className="dashboard-split">
        <Card
          title="Recent Applications"
          subtitle="The eight most recent submissions"
          flush
          actions={
            <Button
              variant="ghost"
              size="sm"
              iconRight={<ArrowRight size={13} />}
              onClick={() => navigate('/admissions')}
            >
              View all
            </Button>
          }
        >
          {recentApplications.length === 0 ? (
            <EmptyState
              icon={<ClipboardList size={20} />}
              title="No applications yet"
              message="Submitted admission applications will appear here as soon as they are recorded."
              action={
                <ButtonLink to="/admissions/new" variant="accent" icon={<Plus size={14} />}>
                  Create the first application
                </ButtonLink>
              }
            />
          ) : (
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Application ID</th>
                    <th>Applicant</th>
                    <th>Program</th>
                    <th>Submitted</th>
                    <th>Status</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {recentApplications.map((application) => {
                    const program = programById(application.program.programId)
                    return (
                      <tr key={application.id}>
                        <td>
                          <span className="table__id">{application.applicationNo}</span>
                        </td>
                        <td>
                          <div className="table__primary">{application.personal.fullName}</div>
                          <div className="table__secondary">
                            {application.program.session}
                          </div>
                        </td>
                        <td>
                          {program ? program.name : <span className="u-text-subtle">—</span>}
                        </td>
                        <td>
                          <div>{formatDate(application.createdAt)}</div>
                          <div className="table__secondary">
                            {relativeTime(application.createdAt)}
                          </div>
                        </td>
                        <td>
                          <ApplicationStatusBadge status={application.status} />
                        </td>
                        <td className="u-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/admissions/${application.id}/edit`)}
                          >
                            Review
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="dashboard-side">
          <Card title="Admission Pipeline" subtitle="Current status of all applications">
            <div style={{ display: 'grid', gap: 13 }}>
              <PipelineRow
                label="Pending"
                count={stats.pending}
                total={stats.totalApplications}
                color="var(--warning)"
              />
              <PipelineRow
                label="Approved"
                count={stats.approved}
                total={stats.totalApplications}
                color="var(--success)"
              />
              <PipelineRow
                label="Rejected"
                count={stats.rejected}
                total={stats.totalApplications}
                color="var(--danger)"
              />
            </div>
          </Card>

          <Card title="Quick Actions">
            <div style={{ display: 'grid', gap: 9 }}>
              <ButtonLink
                to="/admissions/new"
                variant="secondary"
                icon={<Plus size={14} />}
                block
              >
                Record new application
              </ButtonLink>
              <ButtonLink
                to="/students"
                variant="secondary"
                icon={<GraduationCap size={14} />}
                block
              >
                Open student register
              </ButtonLink>
              <ButtonLink
                to="/college"
                variant="secondary"
                icon={<CheckCircle2 size={14} />}
                block
              >
                Update college details
              </ButtonLink>
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}

function PipelineRow({
  label,
  count,
  total,
  color,
}: {
  label: string
  count: number
  total: number
  color: string
}) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 5,
        }}
      >
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{label}</span>
        <span
          style={{
            fontSize: '0.8125rem',
            fontWeight: 600,
            color: 'var(--ink-900)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {count}
        </span>
      </div>
      <div
        style={{
          height: 5,
          background: 'var(--paper)',
          borderRadius: 3,
          overflow: 'hidden',
          border: '1px solid var(--line)',
        }}
      >
        <div
          style={{
            width: `${percentage}%`,
            height: '100%',
            background: color,
            transition: 'width 0.2s ease',
          }}
        />
      </div>
    </div>
  )
}