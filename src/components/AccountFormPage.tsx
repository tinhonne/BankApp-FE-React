import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createAccount } from '../api/accounts'
import { getCustomer } from '../api/customers'
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
  const [initialCustomerId] = useState(() => new URLSearchParams(window.location.search).get('customerId'))
  const [accountNumber, setAccountNumber] = useState('')
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const abortController = useRef<AbortController | null>(null)

  useEffect(() => () => abortController.current?.abort(), [])

  useEffect(() => {
    if (!initialCustomerId) return

    const customerId = Number(initialCustomerId)
    if (!Number.isInteger(customerId) || customerId <= 0) return

    const controller = new AbortController()
    getCustomer(customerId, controller.signal)
      .then((data) => {
        if (data.status === 1) {
          setCustomer(data)
        } else {
          setFormError('The selected customer is inactive and cannot have new accounts.')
        }
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        if (error instanceof HttpError && error.status === 401) {
          onUnauthorized()
          return
        }
        setFormError('Failed to load the specified customer.')
      })

    return () => controller.abort()
  }, [initialCustomerId, onUnauthorized])

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

  const isComplete = accountNumber.length === 13

  const handleCancel = () => {
    if (initialCustomerId) {
      navigate(`/customers/${initialCustomerId}`)
    } else {
      navigate('/accounts')
    }
  }

  return (
    <main className="dashboard-page">
      <PageHeader session={session} onLogout={onLogout} />
      <div className="dashboard-content">
        <div className="page-titlebar">
          <div>
            <div className="breadcrumbs">
              {initialCustomerId ? (
                <>
                  <button type="button" className="breadcrumb-link" onClick={() => navigate('/customers')}>
                    Customers
                  </button>
                  <span className="breadcrumb-separator" aria-hidden="true">/</span>
                  <button
                    type="button"
                    className="breadcrumb-link"
                    onClick={() => navigate(`/customers/${initialCustomerId}`)}
                  >
                    {customer?.name ?? `Customer #${initialCustomerId}`}
                  </button>
                </>
              ) : (
                <button type="button" className="breadcrumb-link" onClick={() => navigate('/accounts')}>
                  Accounts
                </button>
              )}
              <span className="breadcrumb-separator" aria-hidden="true">/</span>
              <span className="breadcrumb-current">New account</span>
            </div>
            <h1>Open New Bank Account</h1>
          </div>
          <button type="button" className="btn" onClick={handleCancel}>
            {initialCustomerId ? 'Back to customer' : 'Back to accounts'}
          </button>
        </div>

        <form className="enterprise-form-card" noValidate onSubmit={handleSubmit}>
          <div className="form-section">
            <div className="form-section-header">
              <h3>Account Opening Details</h3>
              <p>Enter the 13-digit account number and designate the account holder.</p>
            </div>

            <div className="form-grid">
              <div className="form-field">
                <div className="label-row">
                  <label htmlFor="account-number">Account Number</label>
                  <span className={`char-counter ${isComplete ? 'counter-complete' : ''}`}>
                    {accountNumber.length}/13 digits {isComplete ? '✓' : ''}
                  </span>
                </div>
                <input
                  id="account-number"
                  type="text"
                  inputMode="numeric"
                  maxLength={13}
                  value={accountNumber}
                  disabled={isSubmitting}
                  placeholder="e.g. 1000000000001"
                  aria-invalid={Boolean(fieldErrors.accountNumber)}
                  onChange={(event) => {
                    const cleaned = event.target.value.replace(/\D/g, '')
                    setAccountNumber(cleaned)
                    setFieldErrors((current) => ({ ...current, accountNumber: undefined }))
                    setFormError('')
                  }}
                />
                <span className="field-hint">Must be exactly 13 numeric digits.</span>
                {fieldErrors.accountNumber && <span className="field-error">{fieldErrors.accountNumber}</span>}
              </div>

              <div className="form-field">
                <label htmlFor="account-customer">Customer (Account Holder)</label>
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
                <span className="field-hint">Search active customer by name, mobile, or identity number.</span>
                {fieldErrors.customerId && <span className="field-error">{fieldErrors.customerId}</span>}
              </div>

              <div className="form-field">
                <label htmlFor="account-balance">Initial Balance</label>
                <input
                  id="account-balance"
                  type="text"
                  value="0.00"
                  disabled
                  readOnly
                  className="tabular-nums"
                />
                <span className="field-hint">Accounts are initialized with 0.00 balance and assigned pending status (3) awaiting manager approval.</span>
              </div>
            </div>
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
              {isSubmitting ? 'Creating account…' : 'Create account'}
            </button>
            <button type="button" className="btn" disabled={isSubmitting} onClick={handleCancel}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </main>
  )
}