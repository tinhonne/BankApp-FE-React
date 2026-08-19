import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createAccount } from '../api/accounts'
import { HttpError, validationErrors, type ValidationError } from '../api/http'
import type { Customer } from '../api/types'
import type { Session } from '../auth/session'
import { navigate } from '../lib/navigate'
import CustomerSearchSelect from './CustomerSearchSelect'
import PageHeader from './PageHeader'

type FieldErrors = {
  accountNumber?: string
  customerId?: string
}

const REASON_MESSAGES: Record<string, string> = {
  NOT_BLANK: 'This field is required.',
  NOT_NULL: 'This field is required.',
  SIZE: 'Value is too long.',
  PATTERN: 'The format is invalid.',
  POSITIVE: 'Value must be positive.',
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

type AccountFormPageProps = {
  session: Session
  onUnauthorized: () => void
  onLogout: () => void
}

export default function AccountFormPage({ session, onUnauthorized, onLogout }: AccountFormPageProps) {
  const [accountNumber, setAccountNumber] = useState('')
  const [customer, setCustomer] = useState<Customer | null>(null)
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

    const errors: FieldErrors = {}
    if (!accountNumber) {
      errors.accountNumber = 'Account number is required.'
    } else if (!/^\d{13}$/.test(accountNumber)) {
      errors.accountNumber = 'Account number must be exactly 13 digits.'
    }
    const selectedCustomerId = customer?.id ?? null
    if (selectedCustomerId === null) {
      errors.customerId = 'Select a customer.'
    }
    setFieldErrors(errors)
    setFormError('')

    if (Object.keys(errors).length > 0) {
      return
    }

    if (selectedCustomerId === null) {
      return
    }

    const controller = new AbortController()
    abortController.current = controller
    setIsSubmitting(true)

    try {
      const created = await createAccount(
        {
          accountNumber,
          customerId: selectedCustomerId,
          balance: 0,
        },
        controller.signal,
      )
      navigate(`/accounts/${created.id}`)
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
        } else if (error.code === 'ACCOUNT_NUMBER_EXISTED') {
          setFieldErrors((current) => ({
            ...current,
            accountNumber: 'This account number already exists.',
          }))
        } else if (error.code === 'CUSTOMER_INACTIVE') {
          setFormError('The selected customer is inactive and cannot have new accounts.')
        } else if (error.code === 'CUSTOMER_NOT_FOUND') {
          setFormError('The selected customer was not found.')
        } else if (error.code === 'INVALID_INITIAL_BALANCE') {
          setFormError('The initial balance must be zero.')
        } else {
          setFormError(error.message)
        }
      } else {
        setFormError('Unable to create the account. Please try again.')
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
            <p className="eyebrow">Account management</p>
            <h1>New account</h1>
          </div>
          <button type="button" className="btn" onClick={() => navigate('/accounts')}>Back to list</button>
        </div>

        <form className="detail-card customer-form" noValidate onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="account-number">Account number</label>
              <input
                id="account-number"
                type="text"
                inputMode="numeric"
                maxLength={13}
                value={accountNumber}
                disabled={isSubmitting}
                aria-invalid={Boolean(fieldErrors.accountNumber)}
                onChange={(event) => {
                  setAccountNumber(event.target.value)
                  setFieldErrors((current) => ({ ...current, accountNumber: undefined }))
                  setFormError('')
                }}
                placeholder="13 digits"
              />
              {fieldErrors.accountNumber && <span className="field-error">{fieldErrors.accountNumber}</span>}
            </div>
            <div className="form-field">
              <label htmlFor="account-customer">Customer</label>
              <CustomerSearchSelect
                value={customer}
                onChange={(selected) => {
                  setCustomer(selected)
                  setFieldErrors((current) => ({ ...current, customerId: undefined }))
                  setFormError('')
                }}
                onUnauthorized={onUnauthorized}
                disabled={isSubmitting}
              />
              {fieldErrors.customerId && <span className="field-error">{fieldErrors.customerId}</span>}
            </div>
            <div className="form-field">
              <label htmlFor="account-balance">Initial balance</label>
              <input id="account-balance" type="text" value="0.00" disabled readOnly />
              <span className="field-hint">New accounts are created with a zero balance and pending approval.</span>
            </div>
          </div>

          {formError && (
            <div className="form-error" role="alert">
              {formError}
            </div>
          )}

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={isSubmitting} aria-busy={isSubmitting}>
              {isSubmitting ? 'Creating…' : 'Create account'}
            </button>
            <button type="button" className="btn" disabled={isSubmitting} onClick={() => navigate('/accounts')}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </main>
  )
}