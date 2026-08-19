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
    errors.name = 'Name is required.'
  } else if (form.name.length > 100) {
    errors.name = 'Name must be 100 characters or fewer.'
  }

  if (!form.birthday) {
    errors.birthday = 'Birthday is required.'
  } else {
    const birth = new Date(`${form.birthday}T00:00:00`)
    const now = new Date()
    if (Number.isNaN(birth.getTime()) || birth > now) {
      errors.birthday = 'Birthday cannot be in the future.'
    } else {
      const cutoff = new Date(now.getFullYear() - 18, now.getMonth(), now.getDate())
      if (birth > cutoff) {
        errors.birthday = 'Customer must be at least 18 years old.'
      }
    }
  }

  if (!form.address) {
    errors.address = 'Address is required.'
  } else if (form.address.length > 255) {
    errors.address = 'Address must be 255 characters or fewer.'
  }

  if (mode === 'create') {
    if (!form.identityNo) {
      errors.identityNo = 'Identity number is required.'
    } else if (!/^\d{10}$/.test(form.identityNo)) {
      errors.identityNo = 'Identity number must be 10 digits.'
    }
  }

  if (form.mobile && !/^\d{9,10}$/.test(form.mobile)) {
    errors.mobile = 'Mobile must be 9–10 digits.'
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
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(mode === 'edit')
  const [loadError, setLoadError] = useState('')
  const [version, setVersion] = useState<number | null>(null)
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
      .then((data) => {
        setForm({
          name: data.name ?? '',
          birthday: data.birthday ?? '',
          address: data.address ?? '',
          identityNo: data.identityNo ?? '',
          mobile: data.mobile ?? '',
          customerType: data.customerType ?? 'INDIVIDUAL',
        })
        setVersion(data.version)
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
      if (mode === 'edit') {
        if (id === undefined || version === null) {
          throw new Error('Customer version is unavailable.')
        }
        const updated = await updateCustomer(
          id,
          {
            name: form.name,
            birthday: form.birthday,
            address: form.address,
            mobile: form.mobile || undefined,
            customerType: form.customerType,
            version,
          },
          controller.signal,
        )
        navigate(`/customers/${updated.id}`)
      } else {
        const created = await createCustomer(
          {
            name: form.name,
            birthday: form.birthday,
            address: form.address,
            identityNo: form.identityNo,
            mobile: form.mobile || undefined,
            customerType: form.customerType,
            status: 1,
          },
          controller.signal,
        )
        navigate(`/customers/${created.id}`)
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
        } else if (error.code === 'CUSTOMER_EXISTED') {
          setFieldErrors((current) => ({
            ...current,
            identityNo: 'A customer with this identity number already exists.',
          }))
        } else if (error.code === 'CONCURRENT_MODIFICATION') {
          setFormError('This customer was modified by another request. Reload the page and try again.')
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
            <p className="eyebrow">Customer management</p>
            <h1>{mode === 'create' ? 'New customer' : 'Edit customer'}</h1>
          </div>
          <button type="button" className="btn" onClick={() => navigate('/customers')}>Back to list</button>
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
              <div className="form-field">
                <label htmlFor="customer-name">Name</label>
                <input
                  id="customer-name"
                  type="text"
                  maxLength={100}
                  value={form.name}
                  disabled={isSubmitting}
                  aria-invalid={Boolean(fieldErrors.name)}
                  onChange={(event) => updateField('name', event.target.value)}
                />
                {fieldErrors.name && <span className="field-error">{fieldErrors.name}</span>}
              </div>
              <div className="form-field">
                <label htmlFor="customer-birthday">Birthday</label>
                <input
                  id="customer-birthday"
                  type="date"
                  value={form.birthday}
                  disabled={isSubmitting}
                  aria-invalid={Boolean(fieldErrors.birthday)}
                  onChange={(event) => updateField('birthday', event.target.value)}
                />
                {fieldErrors.birthday && <span className="field-error">{fieldErrors.birthday}</span>}
              </div>
              <div className="form-field">
                <label htmlFor="customer-type">Customer type</label>
                <select
                  id="customer-type"
                  value={form.customerType}
                  disabled={isSubmitting}
                  aria-invalid={Boolean(fieldErrors.customerType)}
                  onChange={(event) => updateField('customerType', event.target.value)}
                >
                  <option value="INDIVIDUAL">Individual</option>
                  <option value="CORPORATE">Corporate</option>
                </select>
              </div>
              {mode === 'create' && (
                <div className="form-field">
                  <label htmlFor="customer-identity-no">Identity number</label>
                  <input
                    id="customer-identity-no"
                    type="text"
                    inputMode="numeric"
                    maxLength={10}
                    value={form.identityNo}
                    disabled={isSubmitting}
                    aria-invalid={Boolean(fieldErrors.identityNo)}
                    onChange={(event) => updateField('identityNo', event.target.value)}
                  />
                  {fieldErrors.identityNo && <span className="field-error">{fieldErrors.identityNo}</span>}
                </div>
              )}
              <div className="form-field">
                <label htmlFor="customer-mobile">Mobile (optional)</label>
                <input
                  id="customer-mobile"
                  type="text"
                  inputMode="numeric"
                  maxLength={10}
                  value={form.mobile}
                  disabled={isSubmitting}
                  aria-invalid={Boolean(fieldErrors.mobile)}
                  onChange={(event) => updateField('mobile', event.target.value)}
                />
                {fieldErrors.mobile && <span className="field-error">{fieldErrors.mobile}</span>}
              </div>
              <div className="form-field form-field-full">
                <label htmlFor="customer-address">Address</label>
                <input
                  id="customer-address"
                  type="text"
                  maxLength={255}
                  value={form.address}
                  disabled={isSubmitting}
                  aria-invalid={Boolean(fieldErrors.address)}
                  onChange={(event) => updateField('address', event.target.value)}
                />
                {fieldErrors.address && <span className="field-error">{fieldErrors.address}</span>}
              </div>
            </div>

            {formError && (
              <div className="form-error" role="alert">
                {formError}
              </div>
            )}

            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={isSubmitting} aria-busy={isSubmitting}>
                {isSubmitting ? 'Saving…' : mode === 'create' ? 'Create customer' : 'Save changes'}
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
