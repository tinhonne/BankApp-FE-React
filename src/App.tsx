import { useCallback, useState } from 'react'
import { endSession, getSession } from './auth/session'
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

  const returnToLogin = useCallback(() => {
    endSession()
    navigate('/')
    setNavigationKey((key) => key + 1)
  }, [])

  if (pathname === '/dashboard') {
    if (!session) {
      navigate('/')
      return <LoginPage />
    }

    return <Dashboard session={session} onUnauthorized={returnToLogin} onLogout={returnToLogin} />
  }

  if (session) {
    navigate('/dashboard')
    return <Dashboard session={session} onUnauthorized={returnToLogin} onLogout={returnToLogin} />
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

export default App
