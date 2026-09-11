import { useEffect, useRef, useState, type FormEvent } from 'react'
import { login } from '../api/auth'
import { HttpError } from '../api/http'
import { setAccessToken, setMustChangePassword } from '../auth/tokenStorage'
import { navigate } from '../lib/navigate'

type FieldErrors = {
  username?: string
  password?: string
}

function validate(username: string, password: string) {
  const errors: FieldErrors = {}

  if (!username) {
    errors.username = 'Enter your username.'
  } else if (username.length > 15) {
    errors.username = 'Username must be 15 characters or fewer.'
  }

  if (!password) {
    errors.password = 'Enter your password.'
  } else if (password.length < 8 || password.length > 100) {
    errors.password = 'Password must be between 8 and 100 characters.'
  }

  return errors
}

export default function LoginForm() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const abortController = useRef<AbortController | null>(null)

  useEffect(() => () => abortController.current?.abort(), [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (isSubmitting) {
      return
    }

    const errors = validate(username, password)
    setFieldErrors(errors)
    setFormError('')

    if (Object.keys(errors).length > 0) {
      return
    }

    const controller = new AbortController()
    abortController.current = controller
    setIsSubmitting(true)

    try {
      const result = await login({ username, password }, controller.signal)
      setAccessToken(result.token)
      setMustChangePassword(result.mustChangePassword)
      navigate(result.mustChangePassword ? '/change-password' : '/dashboard')
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }

      setPassword('')

      if (error instanceof HttpError && (error.code === 'USER_NOT_FOUND' || error.code === 'UNAUTHENTICATED' || error.code === 'USER_DISABLED')) {
        setFormError('Invalid username or password. Please check your credentials.')
      } else if (error instanceof HttpError) {
        setFormError(error.message)
      } else {
        setFormError('Unable to sign in. Please verify your connection and try again.')
      }
    } finally {
      setIsSubmitting(false)
      abortController.current = null
    }
  }

  return (
    <form className="login-form" noValidate onSubmit={handleSubmit}>
      <div className="form-field">
        <label htmlFor="username">Username</label>
        <div className="input-with-icon">
          <div className="input-icon-prefix" aria-hidden="true">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            maxLength={15}
            placeholder="e.g. employee01"
            value={username}
            disabled={isSubmitting}
            aria-invalid={Boolean(fieldErrors.username)}
            aria-describedby={fieldErrors.username ? 'username-error' : undefined}
            onChange={(event) => {
              setUsername(event.target.value)
              setFieldErrors((current) => ({ ...current, username: undefined }))
              setFormError('')
            }}
          />
        </div>
        {fieldErrors.username && (
          <span className="field-error" id="username-error">
            {fieldErrors.username}
          </span>
        )}
      </div>

      <div className="form-field">
        <div className="label-row">
          <label htmlFor="password">Password</label>
          <span className="field-hint-mini">Min 8 characters</span>
        </div>
        <div className="input-with-icon">
          <div className="input-icon-prefix" aria-hidden="true">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            minLength={8}
            maxLength={100}
            placeholder="••••••••"
            value={password}
            disabled={isSubmitting}
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={fieldErrors.password ? 'password-error' : undefined}
            onChange={(event) => {
              setPassword(event.target.value)
              setFieldErrors((current) => ({ ...current, password: undefined }))
              setFormError('')
            }}
          />
          <button
            type="button"
            className="password-toggle-btn"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            title={showPassword ? 'Hide password' : 'Show password'}
            tabIndex={0}
          >
            {showPassword ? (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
        {fieldErrors.password && (
          <span className="field-error" id="password-error">
            {fieldErrors.password}
          </span>
        )}
      </div>

      {formError && (
        <div className="form-error" role="alert">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{formError}</span>
        </div>
      )}

      <button type="submit" className="login-submit-btn" disabled={isSubmitting} aria-busy={isSubmitting}>
        {isSubmitting ? (
          <span className="btn-loading-content">
            <span className="loading-spinner-mini" aria-hidden="true" />
            <span>Authenticating…</span>
          </span>
        ) : (
          'Sign in to portal'
        )}
      </button>

      <div className="login-footer-note">
        <span>Protected by enterprise-grade cryptographic session authorization.</span>
      </div>
    </form>
  )
}
