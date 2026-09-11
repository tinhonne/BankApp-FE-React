import type { ReactNode } from 'react'
import type { Session } from '../auth/session'
import { navigate } from '../lib/navigate'
import { usePathname } from '../lib/usePathname'

type PageHeaderProps = {
  session: Session
  onLogout: () => void
}

type NavItem = {
  label: string
  path: string
  active: boolean
  icon: ReactNode
}

export default function PageHeader({ session, onLogout }: PageHeaderProps) {
  const pathname = usePathname()

  const canManageCustomers = session.roles.includes('EMPLOYEE') || session.roles.includes('MANAGER')
  const canManageAccounts = session.roles.includes('EMPLOYEE') || session.roles.includes('MANAGER')
  const canManageTransactions = session.roles.includes('EMPLOYEE') || session.roles.includes('MANAGER')
  const canManageUsers = session.roles.includes('MANAGER') || session.roles.includes('ADMIN')

  const navItems: NavItem[] = [
    {
      label: 'Dashboard',
      path: '/dashboard',
      active: pathname === '/dashboard',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="7" height="9" rx="1" />
          <rect x="14" y="3" width="7" height="5" rx="1" />
          <rect x="14" y="12" width="7" height="9" rx="1" />
          <rect x="3" y="16" width="7" height="5" rx="1" />
        </svg>
      ),
    },
    ...(canManageCustomers
      ? [
          {
            label: 'Customers',
            path: '/customers',
            active: pathname.startsWith('/customers'),
            icon: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            ),
          },
        ]
      : []),
    ...(canManageAccounts
      ? [
          {
            label: 'Accounts',
            path: '/accounts',
            active: pathname.startsWith('/accounts'),
            icon: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <line x1="2" y1="10" x2="22" y2="10" />
              </svg>
            ),
          },
        ]
      : []),
    ...(canManageTransactions
      ? [
          {
            label: 'Transfers',
            path: '/transfer',
            active: pathname === '/transfer' || pathname.startsWith('/transactions'),
            icon: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="7" y1="17" x2="17" y2="7" />
                <polyline points="7 7 17 7 17 17" />
              </svg>
            ),
          },
        ]
      : []),
    ...(canManageUsers
      ? [
          {
            label: 'Users',
            path: '/users',
            active: pathname.startsWith('/users'),
            icon: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            ),
          },
        ]
      : []),
  ]

  const primaryRole = session.roles.includes('ADMIN')
    ? 'ADMIN'
    : session.roles.includes('MANAGER')
      ? 'MANAGER'
      : 'EMPLOYEE'

  return (
    <header className="dashboard-header" role="banner">
      <div className="header-main-row">
        <div className="header-left-cluster">
          <div
            className="dashboard-brand"
            onClick={() => navigate('/dashboard')}
            role="link"
            tabIndex={0}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && navigate('/dashboard')}
            aria-label="Bank Portal Home"
          >
            <div className="brand-mark-mini" aria-hidden="true">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v4M12 14v4M16 14v4" />
              </svg>
            </div>
            <div className="brand-text-block">
              <span className="brand-title">Bank Portal</span>
              <span className="brand-subline">Core Banking</span>
            </div>
          </div>

          <div className="secure-portal-badge" aria-label="Secure session active">
            <span className="status-dot-green" aria-hidden="true" />
            <span>SECURE PORTAL</span>
          </div>
        </div>

        <nav className="dashboard-nav" aria-label="Primary Navigation">
          {navItems.map((item) => (
            <button
              key={item.path}
              type="button"
              className={`nav-tab ${item.active ? 'nav-tab-active' : ''}`}
              aria-current={item.active ? 'page' : undefined}
              onClick={() => navigate(item.path)}
            >
              <span className="nav-tab-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="session-controls">
          <div className="user-profile-badge">
            <div className="user-avatar" aria-hidden="true">
              {session.username.charAt(0).toUpperCase()}
            </div>
            <div className="user-details">
              <strong className="user-name">{session.username}</strong>
              <span className={`user-role-pill role-${primaryRole.toLowerCase()}`}>
                {primaryRole}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="sign-out-btn"
            onClick={onLogout}
            title="Sign out of your session"
            aria-label="Sign out"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>Sign out</span>
          </button>
        </div>
      </div>
    </header>
  )
}
