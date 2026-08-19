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
        setFormError('Invalid username or password.')
      } else if (error instanceof HttpError) {
        setFormError(error.message)
      } else {
        setFormError('Unable to sign in. Please try again.')
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
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          maxLength={15}
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
        {fieldErrors.username && (
          <span className="field-error" id="username-error">
            {fieldErrors.username}
          </span>
        )}
      </div>

      <div className="form-field">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          minLength={8}
          maxLength={100}
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
        {fieldErrors.password && (
          <span className="field-error" id="password-error">
            {fieldErrors.password}
          </span>
        )}
      </div>

      {formError && (
        <div className="form-error" role="alert">
          {formError}
        </div>
      )}

      <button type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
        {isSubmitting ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
