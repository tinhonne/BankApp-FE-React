import { useCallback, useState } from 'react'
import { logout } from './api/auth'
import { clearMustChangePassword, getAccessToken } from './auth/tokenStorage'
import { endSession, getSession } from './auth/session'
import ChangePasswordForm from './components/ChangePasswordForm'
import Dashboard from './components/Dashboard'
import LoginForm from './components/LoginForm'
import './App.css'

function navigate(path: string) {
  window.history.replaceState(null, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function App() {
  const [, setNavigationKey] = useState(0)
  const pathname = window.location.pathname
  const session = getSession()

  const refresh = useCallback(() => setNavigationKey((key) => key + 1), [])

  const returnToLogin = useCallback(() => {
    endSession()
    navigate('/')
    refresh()
  }, [refresh])

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
    navigate('/dashboard')
    refresh()
  }, [refresh])

  const changePasswordPage = (
    <ChangePasswordPage onPasswordChanged={handlePasswordChanged} onUnauthorized={returnToLogin} />
  )

  if (pathname === '/change-password') {
    if (!session) {
      navigate('/')
      return <LoginPage />
    }

    return changePasswordPage
  }

  if (pathname === '/dashboard') {
    if (!session) {
      navigate('/')
      return <LoginPage />
    }

    if (session.mustChangePassword) {
      navigate('/change-password')
      return changePasswordPage
    }

    return <Dashboard session={session} onUnauthorized={returnToLogin} onLogout={handleLogout} />
  }

  if (session) {
    navigate(session.mustChangePassword ? '/change-password' : '/dashboard')
    if (session.mustChangePassword) {
      return changePasswordPage
    }
    return <Dashboard session={session} onUnauthorized={returnToLogin} onLogout={handleLogout} />
  }

  if (pathname !== '/') {
    navigate('/')
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