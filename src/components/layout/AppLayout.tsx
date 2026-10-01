import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  BookOpen,
  Building2,
  ClipboardList,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  ScrollText,
  Settings as SettingsIcon,
  UserCheck,
  X,
} from 'lucide-react'
import { useStore } from '@/store/StoreContext'
import { initials } from '@/lib/format'

interface NavItem {
  to: string
  label: string
  icon: ReactNode
  end?: boolean
}

export function AppLayout() {
  const { session, signOut, applications, programs, students, settings } = useStore()
  const navigate = useNavigate()
  const location = useLocation()

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  const pendingCount = applications.filter((item) => item.status === 'pending').length

  const navGroups: Array<{ label: string; items: NavItem[] }> = [
    {
      label: 'Overview',
      items: [{ to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={16} /> }],
    },
    {
      label: 'Academic',
      items: [
        {
          to: '/admissions',
          label: 'Admissions',
          icon: <ScrollText size={16} />,
          end: true,
        },
        {
          to: '/students',
          label: 'Students',
          icon: <GraduationCap size={16} />,
        },
        {
          to: '/programs',
          label: 'Programs',
          icon: <BookOpen size={16} />,
        },
      ],
    },
    {
      label: 'Institution',
      items: [
        {
          to: '/college',
          label: 'College Information',
          icon: <Building2 size={16} />,
        },
        {
          to: '/location',
          label: 'College Location',
          icon: <MapPin size={16} />,
        },
      ],
    },
    {
      label: 'System',
      items: [{ to: '/settings', label: 'Settings', icon: <SettingsIcon size={16} /> }],
    },
  ]

  // Close the mobile sidebar whenever the route changes.
  useEffect(() => {
    setSidebarOpen(false)
    setUserMenuOpen(false)
  }, [location.pathname])

  // Dismiss the user menu on outside click or Escape.
  useEffect(() => {
    if (!userMenuOpen) return

    const onPointerDown = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setUserMenuOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [userMenuOpen])

  const handleSignOut = () => {
    signOut()
    navigate('/login', { replace: true })
  }

  const collegeName = settings.college.shortName || settings.college.name || 'Law College'

  return (
    <div className="app-shell">
      {sidebarOpen && (
        <div
          className="sidebar-scrim"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside className={['sidebar', sidebarOpen ? 'sidebar--open' : ''].filter(Boolean).join(' ')}>
        <div className="sidebar__brand">
          <span className="sidebar__crest">
            {settings.college.logoDataUrl ? (
              <img src={settings.college.logoDataUrl} alt="" />
            ) : (
              <ScrollText size={18} />
            )}
          </span>
          <span className="sidebar__brand-text">
            <span className="sidebar__brand-name">{collegeName}</span>
            <span className="sidebar__brand-sub">Administration</span>
          </span>
          <button
            type="button"
            className="btn btn--ghost btn--sm mobile-only"
            style={{ marginLeft: 'auto', color: 'rgba(247,245,241,0.7)' }}
            onClick={() => setSidebarOpen(false)}
            aria-label="Close navigation"
          >
            <X size={16} />
          </button>
        </div>

        <nav className="sidebar__nav" aria-label="Main navigation">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="sidebar__section-label">{group.label}</p>
              <ul>
                {group.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) =>
                        ['nav-link', isActive ? 'nav-link--active' : ''].filter(Boolean).join(' ')
                      }
                    >
                      {item.icon}
                      {item.label}
                      {item.to === '/admissions' && pendingCount > 0 && (
                        <span className="nav-link__count">{pendingCount}</span>
                      )}
                      {item.to === '/students' && students.length > 0 && (
                        <span className="nav-link__count">{students.length}</span>
                      )}
                      {item.to === '/programs' && programs.length > 0 && (
                        <span className="nav-link__count">{programs.length}</span>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="sidebar__footer">
          <p className="sidebar__version">Version 1.0 · Local workspace</p>
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <button
            type="button"
            className="btn btn--ghost btn--icon mobile-only"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation"
          >
            <Menu size={18} />
          </button>

          <div className="topbar__heading">
            <p className="topbar__title u-truncate">{collegeName}</p>
            <p className="topbar__breadcrumb desktop-only">
              {settings.college.city ? `${settings.college.city} · ` : ''}
              Administration Portal
            </p>
          </div>

          <div className="topbar__actions">
            <button
              type="button"
              className="btn btn--ghost btn--sm desktop-only"
              onClick={() => navigate('/admissions/new')}
            >
              <FileText size={14} />
              New Application
            </button>

            <span className="topbar__divider desktop-only" aria-hidden="true" />

            <div className="user-menu" ref={userMenuRef}>
              <button
                type="button"
                className="user-menu__trigger"
                onClick={() => setUserMenuOpen((prev) => !prev)}
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
              >
                <span className="avatar">{initials(session?.displayName || 'Admin')}</span>
                <span className="desktop-only">
                  <span className="user-menu__name">{session?.displayName}</span>
                  <br />
                  <span className="user-menu__role">Administrator</span>
                </span>
              </button>

              {userMenuOpen && (
                <div className="user-menu__panel" role="menu">
                  <div className="user-menu__header">
                    <p className="user-menu__name">{session?.displayName}</p>
                    <p className="user-menu__role">Signed in as {session?.username}</p>
                  </div>
                  <button
                    type="button"
                    className="user-menu__item"
                    onClick={() => navigate('/students')}
                    role="menuitem"
                  >
                    <UserCheck size={14} />
                    Student records
                  </button>
                  <button
                    type="button"
                    className="user-menu__item"
                    onClick={() => navigate('/settings')}
                    role="menuitem"
                  >
                    <SettingsIcon size={14} />
                    Settings
                  </button>
                  <button
                    type="button"
                    className="user-menu__item"
                    onClick={() => navigate('/admissions/new')}
                    role="menuitem"
                  >
                    <ClipboardList size={14} />
                    New application
                  </button>
                  <button
                    type="button"
                    className="user-menu__item user-menu__item--danger"
                    onClick={handleSignOut}
                    role="menuitem"
                  >
                    <LogOut size={14} />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="page">
          <Outlet />
        </main>
      </div>
    </div>
  )
}