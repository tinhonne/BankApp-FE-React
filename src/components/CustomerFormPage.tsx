import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createCustomer, getCustomer, updateCustomer } from '../api/customers'
import { HttpError, validationErrors, type ValidationError } from '../api/http'
import type { CustomerType } from '../api/types'
import type { Session } from '../auth/session'
import { navigate } from '../lib/navigate'
import PageHeader from './PageHeader'

type CustomerForm = {
  name: string
  birthday: string
  address: string
  identityNo: string
  mobile: string
  customerType: CustomerType
}

type FieldErrors = {
  name?: string
  birthday?: string
  address?: string
  identityNo?: string
  mobile?: string
  customerType?: string
}

const EMPTY_FORM: CustomerForm = {
  name: '',
  birthday: '',
  address: '',
  identityNo: '',
  mobile: '',
  customerType: 'INDIVIDUAL',
}

const REASON_MESSAGES: Record<string, string> = {
  NOT_BLANK: 'This field is required.',
  NOT_NULL: 'This field is required.',
  SIZE: 'Value is too long.',
  PATTERN: 'The format is invalid.',
  PAST_OR_PRESENT: 'Date cannot be in the future.',
  MINIMUM_AGE: 'Customer must be at least 18 years old.',
  MIN: 'Value is below the minimum.',
  MAX: 'Value is above the maximum.',
}

function errorMessage(error: unknown) {
  if (error instanceof HttpError) {
    return error.message
  }

  return 'Unable to load this information.'
}

function validate(form: CustomerForm, mode: 'create' | 'edit') {
  const errors: FieldErrors = {}

  if (!form.name) {
    errors.name = 'Full legal name is required.'
  } else if (form.name.length > 100) {
    errors.name = 'Name must be 100 characters or fewer.'
  }

  if (!form.birthday) {
    errors.birthday = 'Date of birth is required.'
  } else {
    const birth = new Date(`${form.birthday}T00:00:00`)
    const now = new Date()
    if (Number.isNaN(birth.getTime()) || birth > now) {
      errors.birthday = 'Birthday cannot be in the future.'
    } else {
      const cutoff = new Date(now.getFullYear() - 18, now.getMonth(), now.getDate())
      if (birth > cutoff) {
        errors.birthday = 'Customer must be at least 18 years of age.'
      }
    }
  }

  if (!form.address) {
    errors.address = 'Registered address is required.'
  } else if (form.address.length > 255) {
    errors.address = 'Address must be 255 characters or fewer.'
  }

  if (mode === 'create') {
    if (!form.identityNo) {
      errors.identityNo = 'Identity number is required.'
    } else if (!/^\d{10}$/.test(form.identityNo)) {
      errors.identityNo = 'Identity number must be exactly 10 digits.'
    }
  }

  if (form.mobile && !/^\d{9,10}$/.test(form.mobile)) {
    errors.mobile = 'Mobile number must be 9–10 digits.'
  }

  return errors
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

type CustomerFormPageProps = {
  mode: 'create' | 'edit'
  id?: number
  session: Session
  onUnauthorized: () => void
  onLogout: () => void
}

export default function CustomerFormPage({ mode, id, session, onUnauthorized, onLogout }: CustomerFormPageProps) {
  const [form, setForm] = useState<CustomerForm>(EMPTY_FORM)
  const [version, setVersion] = useState(0)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(mode === 'edit')
  const [loadError, setLoadError] = useState('')
  const abortController = useRef<AbortController | null>(null)

  useEffect(() => () => abortController.current?.abort(), [])

  useEffect(() => {
    if (mode !== 'edit' || id === undefined) {
      return
    }

    const controller = new AbortController()
    setIsLoading(true)
    setLoadError('')
    getCustomer(id, controller.signal)
      .then((customer) => {
        setVersion(customer.version ?? 0)
        setForm({
          name: customer.name ?? '',
          birthday: customer.birthday ?? '',
          address: customer.address ?? '',
          identityNo: customer.identityNo ?? '',
          mobile: customer.mobile ?? '',
          customerType: customer.customerType ?? 'INDIVIDUAL',
        })
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        if (error instanceof HttpError && error.status === 401) {
          onUnauthorized()
          return
        }
        const message = error instanceof HttpError && error.code === 'CUSTOMER_NOT_FOUND'
          ? 'Customer not found.'
          : errorMessage(error)
        setLoadError(message)
      })
      .finally(() => setIsLoading(false))
    return () => controller.abort()
  }, [id, mode, onUnauthorized])

  function updateField(field: keyof CustomerForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
    setFieldErrors((current) => ({ ...current, [field]: undefined }))
    setFormError('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (isSubmitting) {
      return
    }

    const errors = validate(form, mode)
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
        await createCustomer(
          {
            name: form.name.trim(),
            birthday: form.birthday,
            address: form.address.trim(),
            identityNo: form.identityNo.trim(),
            mobile: form.mobile.trim() || undefined,
            customerType: form.customerType,
            status: 1,
          },
          controller.signal,
        )
        navigate('/customers')
      } else {
        if (id === undefined) return
        await updateCustomer(
          id,
          {
            name: form.name.trim(),
            birthday: form.birthday,
            address: form.address.trim(),
            mobile: form.mobile.trim() || undefined,
            customerType: form.customerType,
            version,
          },
          controller.signal,
        )
        navigate(`/customers/${id}`)
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
        } else if (error.code === 'IDENTITY_NUMBER_EXISTED') {
          setFieldErrors((current) => ({
            ...current,
            identityNo: 'A customer with this identity number already exists.',
          }))
        } else if (error.code === 'CUSTOMER_NOT_FOUND') {
          setFormError('The customer was not found.')
        } else {
          setFormError(error.message)
        }
      } else {
        setFormError('Unable to save the customer. Please try again.')
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
              <button type="button" className="breadcrumb-link" onClick={() => navigate('/customers')}>
                Customers
              </button>
              <span className="breadcrumb-separator" aria-hidden="true">/</span>
              <span className="breadcrumb-current">{mode === 'create' ? 'New Customer' : `Edit Customer #${id}`}</span>
            </div>
            <h1>{mode === 'create' ? 'Register New Customer' : 'Edit Customer Profile'}</h1>
          </div>
          <button type="button" className="btn" onClick={() => navigate('/customers')}>
            Back to customers
          </button>
        </div>

        {isLoading && (
          <div className="panel-status-box" role="status">
            <div className="loading-spinner" aria-hidden="true" />
            <p>Loading customer profile…</p>
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
            <div className="form-section">
              <div className="form-section-header">
                <h3>1. Customer Identity & Classification</h3>
                <p>Legal name, classification, and statutory identification details.</p>
              </div>

              <div className="form-grid">
                <div className="form-field">
                  <div className="label-row">
                    <label htmlFor="customer-name">Full Legal Name</label>
                    <span className="char-counter">{form.name.length}/100</span>
                  </div>
                  <input
                    id="customer-name"
                    type="text"
                    maxLength={100}
                    placeholder="e.g. Acme Corporation or Jane Smith"
                    value={form.name}
                    disabled={isSubmitting}
                    aria-invalid={Boolean(fieldErrors.name)}
                    onChange={(event) => updateField('name', event.target.value)}
                  />
                  {fieldErrors.name && <span className="field-error">{fieldErrors.name}</span>}
                </div>

                <div className="form-field">
                  <label htmlFor="customer-type">Customer Classification</label>
                  <div className="segmented-control" role="radiogroup" aria-label="Customer Classification">
                    <button
                      type="button"
                      className={`segmented-btn ${form.customerType === 'INDIVIDUAL' ? 'segmented-btn-active' : ''}`}
                      onClick={() => updateField('customerType', 'INDIVIDUAL')}
                      disabled={isSubmitting}
                    >
                      Individual
                    </button>
                    <button
                      type="button"
                      className={`segmented-btn ${form.customerType === 'CORPORATE' ? 'segmented-btn-active' : ''}`}
                      onClick={() => updateField('customerType', 'CORPORATE')}
                      disabled={isSubmitting}
                    >
                      Corporate
                    </button>
                  </div>
                  <span className="field-hint">Classification defines compliance and reporting rules.</span>
                </div>

                <div className="form-field">
                  <label htmlFor="customer-birthday">Date of Birth / Inception</label>
                  <input
                    id="customer-birthday"
                    type="date"
                    value={form.birthday}
                    disabled={isSubmitting}
                    aria-invalid={Boolean(fieldErrors.birthday)}
                    onChange={(event) => updateField('birthday', event.target.value)}
                  />
                  <span className="field-hint">Customer must be at least 18 years old.</span>
                  {fieldErrors.birthday && <span className="field-error">{fieldErrors.birthday}</span>}
                </div>

                {mode === 'create' ? (
                  <div className="form-field">
                    <div className="label-row">
                      <label htmlFor="customer-identity-no">Identity Number (CCCD / Passport)</label>
                      <span className={`char-counter ${form.identityNo.length === 10 ? 'counter-complete' : ''}`}>
                        {form.identityNo.length}/10 digits
                      </span>
                    </div>
                    <input
                      id="customer-identity-no"
                      type="text"
                      inputMode="numeric"
                      maxLength={10}
                      placeholder="Exactly 10 digits"
                      value={form.identityNo}
                      disabled={isSubmitting}
                      aria-invalid={Boolean(fieldErrors.identityNo)}
                      onChange={(event) => {
                        const cleaned = event.target.value.replace(/\D/g, '')
                        updateField('identityNo', cleaned)
                      }}
                    />
                    <span className="field-hint">Unique 10-digit government-issued citizen identifier.</span>
                    {fieldErrors.identityNo && <span className="field-error">{fieldErrors.identityNo}</span>}
                  </div>
                ) : (
                  <div className="form-field">
                    <label>Identity Number (Immutable)</label>
                    <input type="text" value={form.identityNo} disabled readOnly className="tabular-nums" />
                    <span className="field-hint">Identity numbers cannot be altered after registration.</span>
                  </div>
                )}

                <div className="form-field">
                  <label htmlFor="customer-mobile">Mobile Phone (Optional)</label>
                  <input
                    id="customer-mobile"
                    type="text"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="e.g. 0912345678"
                    value={form.mobile}
                    disabled={isSubmitting}
                    aria-invalid={Boolean(fieldErrors.mobile)}
                    onChange={(event) => {
                      const cleaned = event.target.value.replace(/\D/g, '')
                      updateField('mobile', cleaned)
                    }}
                  />
                  <span className="field-hint">9 to 10 numeric digits. Used for operational notices.</span>
                  {fieldErrors.mobile && <span className="field-error">{fieldErrors.mobile}</span>}
                </div>
              </div>
            </div>

            <div className="form-section">
              <div className="form-section-header">
                <h3>2. Registered Address</h3>
                <p>Official residential or company incorporation address for KYC records.</p>
              </div>

              <div className="form-field form-field-full">
                <div className="label-row">
                  <label htmlFor="customer-address">Address Line</label>
                  <span className="char-counter">{form.address.length}/255</span>
                </div>
                <input
                  id="customer-address"
                  type="text"
                  maxLength={255}
                  placeholder="Street address, city, province/state, postal code"
                  value={form.address}
                  disabled={isSubmitting}
                  aria-invalid={Boolean(fieldErrors.address)}
                  onChange={(event) => updateField('address', event.target.value)}
                />
                <span className="field-hint">Must match official registration or proof-of-address documents.</span>
                {fieldErrors.address && <span className="field-error">{fieldErrors.address}</span>}
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
                {isSubmitting ? 'Saving customer…' : mode === 'create' ? 'Register customer' : 'Save profile'}
              </button>
              <button type="button" className="btn" disabled={isSubmitting} onClick={() => navigate('/customers')}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  )
}
