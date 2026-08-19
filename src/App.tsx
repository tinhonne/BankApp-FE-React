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
import { replacePath } from './lib/navigate'
import { usePathname } from './lib/usePathname'
import './App.css'

function canManageCustomers(session: Session | null) {
  return session !== null && (session.roles.includes('EMPLOYEE') || session.roles.includes('MANAGER'))
}

function canManageAccounts(session: Session | null) {
  return session !== null && (session.roles.includes('EMPLOYEE') || session.roles.includes('MANAGER'))
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
    <main className="login-page">
      <section className="login-panel" aria-labelledby="login-title">
        <div className="brand-mark" aria-hidden="true">B</div>
        <div className="login-heading">
          <p className="eyebrow">Bank App</p>
          <h1 id="login-title">Welcome back</h1>
          <p>Sign in to securely access your banking services.</p>
        </div>
        <LoginForm />
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
        <div className="brand-mark" aria-hidden="true">B</div>
        <div className="login-heading">
          <p className="eyebrow">Bank App</p>
          <h1 id="change-password-title">Change your password</h1>
          <p>You must set a new password before continuing.</p>
        </div>
        <ChangePasswordForm onPasswordChanged={onPasswordChanged} onUnauthorized={onUnauthorized} />
      </section>
    </main>
  )
}

export default App