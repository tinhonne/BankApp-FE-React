import { useCallback } from 'react'
import { logout } from './api/auth'
import { clearMustChangePassword, getAccessToken } from './auth/tokenStorage'
import { endSession, getSession, type Session } from './auth/session'
import AccountDetailPage from './components/AccountDetailPage'
import AccountFormPage from './components/AccountFormPage'
import AccountListPage from './components/AccountListPage'
import ChangePasswordForm from './components/ChangePasswordForm'
import CustomerDetailPage from './components/CustomerDetailPage'
import CustomerFormPage from './components/CustomerFormPage'
import CustomerListPage from './components/CustomerListPage'
import Dashboard from './components/Dashboard'
import LoginForm from './components/LoginForm'
import TransactionHistoryPage from './components/TransactionHistoryPage'
import TransferPage from './components/TransferPage'
import UserDetailPage from './components/UserDetailPage'
import UserFormPage from './components/UserFormPage'
import UserListPage from './components/UserListPage'
import { replacePath } from './lib/navigate'
import { usePathname } from './lib/usePathname'
import './App.css'

function canManageCustomers(session: Session | null) {
  return session !== null && (session.roles.includes('EMPLOYEE') || session.roles.includes('MANAGER'))
}

function canManageAccounts(session: Session | null) {
  return session !== null && (session.roles.includes('EMPLOYEE') || session.roles.includes('MANAGER'))
}

function canManageTransactions(session: Session | null) {
  return session !== null && (session.roles.includes('EMPLOYEE') || session.roles.includes('MANAGER'))
}

function canManageUsers(session: Session | null) {
  return session !== null && (session.roles.includes('MANAGER') || session.roles.includes('ADMIN'))
}

function App() {
  const pathname = usePathname()
  const session = getSession()

  const returnToLogin = useCallback(() => {
    endSession()
    replacePath('/')
  }, [])

  const handleLogout = useCallback(async () => {
    const token = getAccessToken()
    try {
      if (token) {
        await logout(token)
      }
    } catch {
      // Local sign-out must proceed even if the server rejects the token.
    }
    returnToLogin()
  }, [returnToLogin])

  const handlePasswordChanged = useCallback(() => {
    clearMustChangePassword()
    replacePath('/dashboard')
  }, [])

  const changePasswordPage = (
    <ChangePasswordPage onPasswordChanged={handlePasswordChanged} onUnauthorized={returnToLogin} />
  )

  if (pathname === '/change-password') {
    if (!session) {
      replacePath('/')
      return <LoginPage />
    }

    return changePasswordPage
  }

  if (pathname === '/dashboard') {
    if (!session) {
      replacePath('/')
      return <LoginPage />
    }

    if (session.mustChangePassword) {
      replacePath('/change-password')
      return changePasswordPage
    }

    return <Dashboard session={session} onUnauthorized={returnToLogin} onLogout={handleLogout} />
  }

  const customerListRoute = pathname === '/customers'
  const customerCreateRoute = pathname === '/customers/new'
  const customerEditMatch = /^\/customers\/(\d+)\/edit$/.exec(pathname)
  const customerDetailMatch = /^\/customers\/(\d+)$/.exec(pathname)

  if (customerListRoute || customerCreateRoute || customerEditMatch || customerDetailMatch) {
    if (!session) {
      replacePath('/')
      return <LoginPage />
    }

    if (!canManageCustomers(session)) {
      replacePath('/dashboard')
      return <Dashboard session={session} onUnauthorized={returnToLogin} onLogout={handleLogout} />
    }

    if (customerCreateRoute) {
      return (
        <CustomerFormPage
          mode="create"
          session={session}
          onUnauthorized={returnToLogin}
          onLogout={handleLogout}
        />
      )
    }

    if (customerEditMatch) {
      return (
        <CustomerFormPage
          mode="edit"
          id={Number(customerEditMatch[1])}
          session={session}
          onUnauthorized={returnToLogin}
          onLogout={handleLogout}
        />
      )
    }

    if (customerDetailMatch) {
      return (
        <CustomerDetailPage
          id={Number(customerDetailMatch[1])}
          session={session}
          onUnauthorized={returnToLogin}
          onLogout={handleLogout}
        />
      )
    }

    return <CustomerListPage session={session} onUnauthorized={returnToLogin} onLogout={handleLogout} />
  }

  const accountListRoute = pathname === '/accounts'
  const accountCreateRoute = pathname === '/accounts/new'
  const accountDetailMatch = /^\/accounts\/(\d+)$/.exec(pathname)

  if (accountListRoute || accountCreateRoute || accountDetailMatch) {
    if (!session) {
      replacePath('/')
      return <LoginPage />
    }

    if (!canManageAccounts(session)) {
      replacePath('/dashboard')
      return <Dashboard session={session} onUnauthorized={returnToLogin} onLogout={handleLogout} />
    }

    if (accountCreateRoute) {
      return (
        <AccountFormPage
          session={session}
          onUnauthorized={returnToLogin}
          onLogout={handleLogout}
        />
      )
    }

    if (accountDetailMatch) {
      return (
        <AccountDetailPage
          id={Number(accountDetailMatch[1])}
          session={session}
          onUnauthorized={returnToLogin}
          onLogout={handleLogout}
        />
      )
    }

    return <AccountListPage session={session} onUnauthorized={returnToLogin} onLogout={handleLogout} />
  }

  const transferRoute = pathname === '/transactions/transfer' || pathname === '/transfer'
  const transactionHistoryMatch = /^\/transactions\/history\/(\d{13})$/.exec(pathname)

  if (transferRoute || transactionHistoryMatch) {
    if (!session) {
      replacePath('/')
      return <LoginPage />
    }

    if (!canManageTransactions(session)) {
      replacePath('/dashboard')
      return <Dashboard session={session} onUnauthorized={returnToLogin} onLogout={handleLogout} />
    }

    if (transferRoute) {
      return <TransferPage session={session} onUnauthorized={returnToLogin} onLogout={handleLogout} />
    }

    return (
      <TransactionHistoryPage
        accountNumber={transactionHistoryMatch![1]}
        session={session}
        onUnauthorized={returnToLogin}
        onLogout={handleLogout}
      />
    )
  }

  const userListRoute = pathname === '/users'
  const userCreateRoute = pathname === '/users/new'
  const userEditMatch = /^\/users\/(\d+)\/edit$/.exec(pathname)
  const userDetailMatch = /^\/users\/(\d+)$/.exec(pathname)

  if (userListRoute || userCreateRoute || userEditMatch || userDetailMatch) {
    if (!session) {
      replacePath('/')
      return <LoginPage />
    }

    if (!canManageUsers(session)) {
      replacePath('/dashboard')
      return <Dashboard session={session} onUnauthorized={returnToLogin} onLogout={handleLogout} />
    }

    if (userCreateRoute) {
      return (
        <UserFormPage
          mode="create"
          session={session}
          onUnauthorized={returnToLogin}
          onLogout={handleLogout}
        />
      )
    }

    if (userEditMatch) {
      return (
        <UserFormPage
          mode="edit"
          id={Number(userEditMatch[1])}
          session={session}
          onUnauthorized={returnToLogin}
          onLogout={handleLogout}
        />
      )
    }

    if (userDetailMatch) {
      return (
        <UserDetailPage
          id={Number(userDetailMatch[1])}
          session={session}
          onUnauthorized={returnToLogin}
          onLogout={handleLogout}
        />
      )
    }

    return <UserListPage session={session} onUnauthorized={returnToLogin} onLogout={handleLogout} />
  }

  if (session) {
    replacePath(session.mustChangePassword ? '/change-password' : '/dashboard')
    if (session.mustChangePassword) {
      return changePasswordPage
    }
    return <Dashboard session={session} onUnauthorized={returnToLogin} onLogout={handleLogout} />
  }

  if (pathname !== '/') {
    replacePath('/')
  }

  return <LoginPage />
}

function LoginPage() {
  return (
    <main className="login-split-page">
      <section className="login-showcase-panel" aria-label="Portal Overview">
        <div className="showcase-content">
          <div className="showcase-brand">
            <div className="brand-mark-showcase" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v4M12 14v4M16 14v4" />
              </svg>
            </div>
            <div>
              <span className="showcase-portal-title">Bank Portal</span>
              <span className="showcase-portal-badge">Enterprise Edition</span>
            </div>
          </div>

          <div className="showcase-headline">
            <h2>Secure Financial Operations & Core Ledger Management</h2>
            <p>
              Unified banking portal for high-integrity transfers, account administration, and customer lifecycle governance.
            </p>
          </div>

          <div className="trust-badges-list">
            <div className="trust-badge-item">
              <div className="trust-badge-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <div>
                <strong>HS512 Encrypted Sessions</strong>
                <span>Cryptographically verified credentials with time-bound JWT tokens</span>
              </div>
            </div>

            <div className="trust-badge-item">
              <div className="trust-badge-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <div>
                <strong>Role-Based Access Control</strong>
                <span>Strict operational separation between Employee, Manager, and Admin</span>
              </div>
            </div>

            <div className="trust-badge-item">
              <div className="trust-badge-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              </div>
              <div>
                <strong>Audited Transaction Ledger</strong>
                <span>Pessimistic account locking guaranteeing real-time balance integrity</span>
              </div>
            </div>
          </div>

          <div className="showcase-footer">
            <span>© 2026 Core Financial Banking Portal. All rights reserved.</span>
          </div>
        </div>
      </section>

      <section className="login-auth-panel" aria-labelledby="login-title">
        <div className="login-panel-inner">
          <div className="auth-header">
            <div className="security-notice-pill">
              <span className="status-dot-green" aria-hidden="true" />
              <span>Authorized Personnel Only</span>
            </div>
            <h1 id="login-title">Sign in to Portal</h1>
            <p>Enter your assigned system credentials to access banking services.</p>
          </div>
          <LoginForm />
        </div>
      </section>
    </main>
  )
}

function ChangePasswordPage({
  onPasswordChanged,
  onUnauthorized,
}: {
  onPasswordChanged: () => void
  onUnauthorized: () => void
}) {
  return (
    <main className="login-page">
      <section className="login-panel" aria-labelledby="change-password-title">
        <div className="brand-mark" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v4M12 14v4M16 14v4" />
          </svg>
        </div>
        <div className="login-heading">
          <p className="eyebrow">Security Requirement</p>
          <h1 id="change-password-title">Change your password</h1>
          <p>You must set a secure new password before accessing the portal.</p>
        </div>
        <ChangePasswordForm onPasswordChanged={onPasswordChanged} onUnauthorized={onUnauthorized} />
      </section>
    </main>
  )
}

export default App