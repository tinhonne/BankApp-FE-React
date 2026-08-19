import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createUser, getUser, updateUser } from '../api/users'
import { HttpError, validationErrors, type ValidationError } from '../api/http'
import type { Role } from '../api/types'
import type { Session } from '../auth/session'
import { navigate } from '../lib/navigate'
import PageHeader from './PageHeader'

type FieldErrors = {
  username?: string
  password?: string
  name?: string
}

const REASON_MESSAGES: Record<string, string> = {
  NOT_BLANK: 'This field is required.',
  NOT_NULL: 'This field is required.',
  SIZE: 'Value is too long.',
  PATTERN: 'The format is invalid.',
  NOT_BLANK_PATTERN: 'Value cannot be blank.',
}

function errorMessage(error: unknown) {
  if (error instanceof HttpError) {
    return error.message
  }

  return 'Unable to load this information.'
}

function applyServerErrors(errors: ValidationError[]): FieldErrors {
  const result: FieldErrors = {}
  for (const error of errors) {
    if (!error.field || result[error.field as keyof FieldErrors]) {
      continue
    }
    result[error.field as keyof FieldErrors] = REASON_MESSAGES[error.reason] ?? 'This value is invalid.'
  }
  return result
}

function validateCreate(form: { username: string; password: string; name: string }) {
  const errors: FieldErrors = {}

  if (!form.username) {
    errors.username = 'Username is required.'
  } else if (form.username.length > 15) {
    errors.username = 'Username must be 15 characters or fewer.'
  }

  if (!form.password) {
    errors.password = 'Password is required.'
  } else if (form.password.length < 8 || form.password.length > 100) {
    errors.password = 'Password must be between 8 and 100 characters.'
  }

  if (!form.name) {
    errors.name = 'Name is required.'
  } else if (form.name.length > 20) {
    errors.name = 'Name must be 20 characters or fewer.'
  }

  return errors
}

function validateEdit(form: { name: string }) {
  const errors: FieldErrors = {}

  if (!form.name) {
    errors.name = 'Name is required.'
  } else if (form.name.length > 20) {
    errors.name = 'Name must be 20 characters or fewer.'
  }

  return errors
}

type UserFormPageProps = {
  mode: 'create' | 'edit'
  id?: number
  session: Session
  onUnauthorized: () => void
  onLogout: () => void
}

export default function UserFormPage({ mode, id, session, onUnauthorized, onLogout }: UserFormPageProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [roles, setRoles] = useState<Role[]>(['EMPLOYEE'])
  const [availableRoles, setAvailableRoles] = useState<Role[]>([])
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(mode === 'edit')
  const [loadError, setLoadError] = useState('')
  const abortController = useRef<AbortController | null>(null)

  useEffect(() => () => abortController.current?.abort(), [])

  const isAdmin = session.roles.includes('ADMIN')

  useEffect(() => {
    if (mode !== 'edit' || id === undefined) {
      if (isAdmin) {
        setAvailableRoles(['EMPLOYEE', 'MANAGER', 'ADMIN'])
      } else {
        setAvailableRoles(['EMPLOYEE'])
      }
      return
    }

    const controller = new AbortController()
    setIsLoading(true)
    setLoadError('')
    getUser(id, controller.signal)
      .then((data) => {
        setUsername(data.username ?? '')
        setName(data.name ?? '')
        setRoles(data.roles)
        setAvailableRoles(isAdmin ? ['EMPLOYEE', 'MANAGER', 'ADMIN'] : ['EMPLOYEE'])
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        if (error instanceof HttpError && error.status === 401) {
          onUnauthorized()
          return
        }
        const message = error instanceof HttpError && error.code === 'USER_NOT_FOUND'
          ? 'User not found.'
          : errorMessage(error)
        setLoadError(message)
      })
      .finally(() => setIsLoading(false))
    return () => controller.abort()
  }, [id, mode, isAdmin, onUnauthorized])

  function updateField(field: keyof FieldErrors, value: string) {
    if (field === 'username') setUsername(value)
    else if (field === 'password') setPassword(value)
    else if (field === 'name') setName(value)
    setFieldErrors((current) => ({ ...current, [field]: undefined }))
    setFormError('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (isSubmitting) {
      return
    }

    let errors: FieldErrors
    if (mode === 'create') {
      errors = validateCreate({ username, password, name })
    } else {
      errors = validateEdit({ name })
    }
    setFieldErrors(errors)
    setFormError('')

    if (Object.keys(errors).length > 0) {
      return
    }

    const controller = new AbortController()
    abortController.current = controller
    setIsSubmitting(true)

    try {
      if (mode === 'create') {
        await createUser({ username, password, name, roles }, controller.signal)
        navigate('/users')
      } else {
        if (id === undefined) return
        const updateData: { name?: string; roles?: Role[] } = {}
        if (name) updateData.name = name
        if (isAdmin && roles.length > 0) updateData.roles = roles
        await updateUser(id, updateData, controller.signal)
        navigate(`/users/${id}`)
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }
      if (error instanceof HttpError) {
        if (error.status === 401) {
          onUnauthorized()
          return
        }
        if (error.code === 'INVALID_INPUT') {
          const serverErrors = validationErrors(error)
          if (serverErrors.length > 0) {
            setFieldErrors(applyServerErrors(serverErrors))
            setFormError('Please review the highlighted fields.')
          } else {
            setFormError(error.message)
          }
        } else if (error.code === 'USER_EXISTED') {
          setFieldErrors((current) => ({
            ...current,
            username: 'A user with this username already exists.',
          }))
        } else if (error.code === 'FORBIDDEN_ASSIGN_ROLE') {
          setFormError('You are not allowed to assign restricted roles.')
        } else if (error.code === 'INVALID_USER_UPDATE') {
          setFormError('At least one field must be provided for update.')
        } else if (error.code === 'FORBIDDEN') {
          setFormError('You are not authorized to perform this action.')
        } else {
          setFormError(error.message)
        }
      } else {
        setFormError('Unable to save the user. Please try again.')
      }
    } finally {
      setIsSubmitting(false)
      abortController.current = null
    }
  }

  return (
    <main className="dashboard-page">
      <PageHeader session={session} onLogout={onLogout} />
      <div className="dashboard-content">
        <div className="page-titlebar">
          <div>
            <p className="eyebrow">User management</p>
            <h1>{mode === 'create' ? 'New user' : 'Edit user'}</h1>
          </div>
          <button type="button" className="btn" onClick={() => navigate('/users')}>Back to list</button>
        </div>

        {isLoading && <p className="panel-status" role="status">Loading…</p>}

        {loadError && (
          <section className="data-panel">
            <div className="panel-error" role="alert">
              <p>{loadError}</p>
            </div>
          </section>
        )}

        {!isLoading && !loadError && (
          <form className="detail-card customer-form" noValidate onSubmit={handleSubmit}>
            <div className="form-grid">
              {mode === 'create' && (
                <>
                  <div className="form-field">
                    <label htmlFor="user-username">Username</label>
                    <input
                      id="user-username"
                      type="text"
                      maxLength={15}
                      value={username}
                      disabled={isSubmitting}
                      aria-invalid={Boolean(fieldErrors.username)}
                      onChange={(event) => updateField('username', event.target.value)}
                    />
                    {fieldErrors.username && <span className="field-error">{fieldErrors.username}</span>}
                  </div>
                  <div className="form-field">
                    <label htmlFor="user-password">Password</label>
                    <input
                      id="user-password"
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      maxLength={100}
                      value={password}
                      disabled={isSubmitting}
                      aria-invalid={Boolean(fieldErrors.password)}
                      onChange={(event) => updateField('password', event.target.value)}
                    />
                    {fieldErrors.password && <span className="field-error">{fieldErrors.password}</span>}
                  </div>
                </>
              )}
              <div className="form-field">
                <label htmlFor="user-name">Name</label>
                <input
                  id="user-name"
                  type="text"
                  maxLength={20}
                  value={name}
                  disabled={isSubmitting}
                  aria-invalid={Boolean(fieldErrors.name)}
                  onChange={(event) => updateField('name', event.target.value)}
                />
                {fieldErrors.name && <span className="field-error">{fieldErrors.name}</span>}
              </div>
              {isAdmin && (
                <div className="form-field">
                  <label>Roles</label>
                  <div className="checkbox-group">
                    {(mode === 'edit' ? availableRoles : (['EMPLOYEE', 'MANAGER', 'ADMIN'] as const)).map((role) => (
                      <label key={role} className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={roles.includes(role)}
                          onChange={(event) => {
                            if (event.target.checked) {
                              setRoles((current) => [...current, role])
                            } else {
                              setRoles((current) => current.filter((r) => r !== role))
                            }
                            setFieldErrors((current) => ({ ...current }))
                            setFormError('')
                          }}
                        />
                        <span>{role}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {!isAdmin && (
                <div className="form-field">
                  <label>Role</label>
                  <div className="checkbox-group disabled">
                    <label className="checkbox-label">
                      <input type="checkbox" checked={true} disabled />
                      <span>EMPLOYEE (default)</span>
                    </label>
                  </div>
                  <span className="field-hint">Only ADMIN can assign other roles.</span>
                </div>
              )}
            </div>

            {formError && (
              <div className="form-error" role="alert">
                {formError}
              </div>
            )}

            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={isSubmitting} aria-busy={isSubmitting}>
                {isSubmitting ? 'Saving…' : mode === 'create' ? 'Create user' : 'Save changes'}
              </button>
              <button type="button" className="btn" disabled={isSubmitting} onClick={() => navigate('/users')}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  )
}