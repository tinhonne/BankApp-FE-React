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
    errors.name = 'Full name is required.'
  } else if (form.name.length > 20) {
    errors.name = 'Full name must be 20 characters or fewer.'
  }

  return errors
}

function validateEdit(form: { name: string }) {
  const errors: FieldErrors = {}

  if (!form.name) {
    errors.name = 'Full name is required.'
  } else if (form.name.length > 20) {
    errors.name = 'Full name must be 20 characters or fewer.'
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

type RoleDef = {
  role: Role
  title: string
  tagline: string
  description: string
  icon: string
}

const ROLE_DEFINITIONS: RoleDef[] = [
  {
    role: 'EMPLOYEE',
    title: 'Employee (Giao dịch viên)',
    tagline: 'Standard Operations',
    description: 'Manage customers, view accounts, and execute fund transfers.',
    icon: 'user',
  },
  {
    role: 'MANAGER',
    title: 'Manager (Kiểm soát viên)',
    tagline: 'Supervisory Authority',
    description: 'Approve, reject, freeze, unfreeze, and close accounts.',
    icon: 'briefcase',
  },
  {
    role: 'ADMIN',
    title: 'Admin (Quản trị viên)',
    tagline: 'System Governance',
    description: 'Create system users, configure permissions, and view audit trails.',
    icon: 'shield',
  },
]

export default function UserFormPage({ mode, id, session, onUnauthorized, onLogout }: UserFormPageProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [name, setName] = useState('')
  const [roles, setRoles] = useState<Role[]>(['EMPLOYEE'])
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

  function handleToggleRole(role: Role) {
    if (!isAdmin && mode === 'edit') return
    if (roles.includes(role)) {
      if (roles.length === 1) {
        setFormError('User must have at least one role assigned.')
        return
      }
      setRoles((current) => current.filter((r) => r !== role))
    } else {
      setRoles((current) => [...current, role])
    }
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

    if (roles.length === 0) {
      setFormError('Select at least one role for this user.')
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
            <div className="breadcrumbs">
              <button type="button" className="breadcrumb-link" onClick={() => navigate('/users')}>
                Users
              </button>
              <span className="breadcrumb-separator" aria-hidden="true">/</span>
              <span className="breadcrumb-current">{mode === 'create' ? 'New User' : `Edit User #${id}`}</span>
            </div>
            <h1>{mode === 'create' ? 'Create New System User' : 'Edit User Profile'}</h1>
          </div>
          <button type="button" className="btn" onClick={() => navigate('/users')}>
            Back to users
          </button>
        </div>

        {isLoading && (
          <div className="panel-status-box" role="status">
            <div className="loading-spinner" aria-hidden="true" />
            <p>Loading user profile…</p>
          </div>
        )}

        {loadError && (
          <section className="data-panel">
            <div className="panel-error" role="alert">
              <p>{loadError}</p>
            </div>
          </section>
        )}

        {!isLoading && !loadError && (
          <form className="enterprise-form-card" noValidate onSubmit={handleSubmit}>
            {/* Section 1: Account Credentials */}
            <div className="form-section">
              <div className="form-section-header">
                <h3>1. Account Credentials</h3>
                <p>System credentials used by the staff member to authenticate into the banking portal.</p>
              </div>

              <div className="form-grid">
                {mode === 'create' && (
                  <>
                    <div className="form-field">
                      <div className="label-row">
                        <label htmlFor="user-username">Username</label>
                        <span className="char-counter">{username.length}/15</span>
                      </div>
                      <input
                        id="user-username"
                        type="text"
                        maxLength={15}
                        placeholder="e.g. jdoe_ops"
                        value={username}
                        disabled={isSubmitting}
                        aria-invalid={Boolean(fieldErrors.username)}
                        onChange={(event) => updateField('username', event.target.value)}
                      />
                      <span className="field-hint">Unique alphanumeric identifier (max 15 characters).</span>
                      {fieldErrors.username && <span className="field-error">{fieldErrors.username}</span>}
                    </div>

                    <div className="form-field">
                      <div className="label-row">
                        <label htmlFor="user-password">Initial Password</label>
                        <span className="char-counter">{password.length}/100</span>
                      </div>
                      <div className="input-with-icon">
                        <input
                          id="user-password"
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="new-password"
                          minLength={8}
                          maxLength={100}
                          placeholder="Min 8 characters"
                          value={password}
                          disabled={isSubmitting}
                          aria-invalid={Boolean(fieldErrors.password)}
                          onChange={(event) => updateField('password', event.target.value)}
                        />
                        <button
                          type="button"
                          className="password-toggle-btn"
                          onClick={() => setShowPassword((prev) => !prev)}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
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
                      <span className="field-hint">Must be 8 to 100 characters. Staff will be prompted to change password if required.</span>
                      {fieldErrors.password && <span className="field-error">{fieldErrors.password}</span>}
                    </div>
                  </>
                )}

                <div className={`form-field ${mode === 'edit' ? 'form-field-full' : ''}`}>
                  <div className="label-row">
                    <label htmlFor="user-name">Full Name</label>
                    <span className="char-counter">{name.length}/20</span>
                  </div>
                  <input
                    id="user-name"
                    type="text"
                    maxLength={20}
                    placeholder="e.g. Johnathan Doe"
                    value={name}
                    disabled={isSubmitting}
                    aria-invalid={Boolean(fieldErrors.name)}
                    onChange={(event) => updateField('name', event.target.value)}
                  />
                  <span className="field-hint">Staff member's legal full name (max 20 characters).</span>
                  {fieldErrors.name && <span className="field-error">{fieldErrors.name}</span>}
                </div>
              </div>
            </div>

            {/* Section 2: Role & Permissions */}
            <div className="form-section">
              <div className="form-section-header">
                <h3>2. Role Assignment & Access Governance</h3>
                <p>
                  {isAdmin
                    ? 'Select one or more functional roles to assign to this portal user.'
                    : 'Standard employee role is assigned automatically by policy.'}
                </p>
              </div>

              <div className="role-cards-grid">
                {ROLE_DEFINITIONS.map((def) => {
                  const isAssigned = roles.includes(def.role)
                  const canToggle = isAdmin

                  return (
                    <div
                      key={def.role}
                      className={`role-selection-card ${isAssigned ? 'role-card-active' : ''} ${!canToggle ? 'role-card-disabled' : ''}`}
                      onClick={() => canToggle && handleToggleRole(def.role)}
                      role="checkbox"
                      aria-checked={isAssigned}
                      tabIndex={canToggle ? 0 : -1}
                      onKeyDown={(e) => {
                        if (canToggle && (e.key === ' ' || e.key === 'Enter')) {
                          e.preventDefault()
                          handleToggleRole(def.role)
                        }
                      }}
                    >
                      <div className="role-card-header">
                        <div className="role-card-title-group">
                          <span className="role-tagline">{def.tagline}</span>
                          <h4 className="role-title">{def.title}</h4>
                        </div>
                        <div className={`role-checkbox-indicator ${isAssigned ? 'checked' : ''}`}>
                          {isAssigned && (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </div>
                      </div>
                      <p className="role-card-desc">{def.description}</p>
                    </div>
                  )
                })}
              </div>

              {!isAdmin && (
                <div className="role-admin-notice">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                  <span>Administrative privileges are required to assign Manager or Admin roles.</span>
                </div>
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

            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={isSubmitting} aria-busy={isSubmitting}>
                {isSubmitting ? 'Saving user…' : mode === 'create' ? 'Create user' : 'Save changes'}
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