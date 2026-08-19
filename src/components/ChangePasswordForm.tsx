import { useEffect, useRef, useState, type FormEvent } from 'react'
import { HttpError } from '../api/http'
import { changePassword } from '../api/users'

type FieldErrors = {
  currentPassword?: string
  newPassword?: string
  confirmPassword?: string
}

type ChangePasswordFormProps = {
  onPasswordChanged: () => void
  onUnauthorized: () => void
}

function validate(currentPassword: string, newPassword: string, confirmPassword: string) {
  const errors: FieldErrors = {}

  if (!currentPassword) {
    errors.currentPassword = 'Enter your current password.'
  }

  if (!newPassword) {
    errors.newPassword = 'Enter a new password.'
  } else if (newPassword.length < 8 || newPassword.length > 100) {
    errors.newPassword = 'Password must be between 8 and 100 characters.'
  }

  if (!confirmPassword) {
    errors.confirmPassword = 'Confirm your new password.'
  } else if (confirmPassword !== newPassword) {
    errors.confirmPassword = 'Passwords do not match.'
  }

  return errors
}

export default function ChangePasswordForm({ onPasswordChanged, onUnauthorized }: ChangePasswordFormProps) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
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

    const errors = validate(currentPassword, newPassword, confirmPassword)
    setFieldErrors(errors)
    setFormError('')

    if (Object.keys(errors).length > 0) {
      return
    }

    const controller = new AbortController()
    abortController.current = controller
    setIsSubmitting(true)

    try {
      await changePassword(currentPassword, newPassword, controller.signal)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      onPasswordChanged()
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }

      if (error instanceof HttpError) {
        if (error.status === 401 && error.code !== 'INCORRECT_OLD_PASSWORD') {
          onUnauthorized()
          return
        }
        if (error.code === 'INCORRECT_OLD_PASSWORD') {
          setFormError('Your current password is incorrect.')
        } else if (error.code === 'NEW_PASSWORD_SAME_AS_OLD') {
          setFormError('New password must be different from your current password.')
        } else {
          setFormError(error.message)
        }
      } else {
        setFormError('Unable to update your password. Please try again.')
      }
    } finally {
      setIsSubmitting(false)
      abortController.current = null
    }
  }

  return (
    <form className="login-form" noValidate onSubmit={handleSubmit}>
      <div className="form-field">
        <label htmlFor="current-password">Current password</label>
        <input
          id="current-password"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          disabled={isSubmitting}
          aria-invalid={Boolean(fieldErrors.currentPassword)}
          aria-describedby={fieldErrors.currentPassword ? 'current-password-error' : undefined}
          onChange={(event) => {
            setCurrentPassword(event.target.value)
            setFieldErrors((current) => ({ ...current, currentPassword: undefined }))
            setFormError('')
          }}
        />
        {fieldErrors.currentPassword && (
          <span className="field-error" id="current-password-error">
            {fieldErrors.currentPassword}
          </span>
        )}
      </div>

      <div className="form-field">
        <label htmlFor="new-password">New password</label>
        <input
          id="new-password"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={100}
          value={newPassword}
          disabled={isSubmitting}
          aria-invalid={Boolean(fieldErrors.newPassword)}
          aria-describedby={fieldErrors.newPassword ? 'new-password-error' : undefined}
          onChange={(event) => {
            setNewPassword(event.target.value)
            setFieldErrors((current) => ({ ...current, newPassword: undefined }))
            setFormError('')
          }}
        />
        {fieldErrors.newPassword && (
          <span className="field-error" id="new-password-error">
            {fieldErrors.newPassword}
          </span>
        )}
      </div>

      <div className="form-field">
        <label htmlFor="confirm-password">Confirm new password</label>
        <input
          id="confirm-password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          disabled={isSubmitting}
          aria-invalid={Boolean(fieldErrors.confirmPassword)}
          aria-describedby={fieldErrors.confirmPassword ? 'confirm-password-error' : undefined}
          onChange={(event) => {
            setConfirmPassword(event.target.value)
            setFieldErrors((current) => ({ ...current, confirmPassword: undefined }))
            setFormError('')
          }}
        />
        {fieldErrors.confirmPassword && (
          <span className="field-error" id="confirm-password-error">
            {fieldErrors.confirmPassword}
          </span>
        )}
      </div>

      {formError && (
        <div className="form-error" role="alert">
          {formError}
        </div>
      )}

      <button type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
        {isSubmitting ? 'Updating…' : 'Change password'}
      </button>
    </form>
  )
}