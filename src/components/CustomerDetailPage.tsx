import { useCallback, useEffect, useState } from 'react'
import { deleteCustomer, getCustomer, updateCustomerStatus } from '../api/customers'
import { HttpError } from '../api/http'
import type { Customer } from '../api/types'
import type { Session } from '../auth/session'
import { navigate } from '../lib/navigate'
import PageHeader from './PageHeader'

type State = {
  data: Customer | null
  error: string
  loading: boolean
}

const initialState: State = { data: null, error: '', loading: true }

function errorMessage(error: unknown) {
  if (error instanceof HttpError) {
    return error.message
  }

  return 'Unable to load this information.'
}

function actionErrorMessage(error: unknown) {
  if (error instanceof HttpError) {
    if (error.code === 'CUSTOMER_HAS_ACCOUNT') {
      return 'Customer still has active, frozen, or pending accounts and cannot be deactivated.'
    }
    if (error.code === 'INVALID_CUSTOMER_STATUS_TRANSITION') {
      return 'The requested status change is not allowed.'
    }
    if (error.code === 'CONCURRENT_MODIFICATION') {
      return 'This customer was modified by another request. Reload and try again.'
    }
    return error.message
  }

  return 'The operation could not be completed. Please try again.'
}

function formatDateTime(value: string | null) {
  if (!value) {
    return '—'
  }
  return value.replace('T', ' ')
}

type CustomerDetailPageProps = {
  id: number
  session: Session
  onUnauthorized: () => void
  onLogout: () => void
}

export default function CustomerDetailPage({ id, session, onUnauthorized, onLogout }: CustomerDetailPageProps) {
  const [state, setState] = useState<State>(initialState)
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState<'status' | 'delete' | null>(null)

  const handleError = useCallback(
    (error: unknown) => {
      if (error instanceof HttpError && error.status === 401) {
        onUnauthorized()
        return true
      }
      return false
    },
    [onUnauthorized],
  )

  useEffect(() => {
    const controller = new AbortController()
    setState((current) => ({ ...current, error: '', loading: true }))
    getCustomer(id, controller.signal)
      .then((data) => setState({ data, error: '', loading: false }))
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        if (!handleError(error)) {
          const message = error instanceof HttpError && error.code === 'CUSTOMER_NOT_FOUND'
            ? 'Customer not found.'
            : errorMessage(error)
          setState({ data: null, error: message, loading: false })
        }
      })
    return () => controller.abort()
  }, [handleError, id])

  async function handleToggleStatus() {
    const customer = state.data
    if (!customer || customer.id === null) return

    const nextStatus = customer.status === 1 ? 0 : 1
    setBusy('status')
    setActionError('')

    try {
      const updated = await updateCustomerStatus(customer.id, nextStatus)
      setState((current) => ({ ...current, data: updated }))
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      if (!handleError(error)) {
        setActionError(actionErrorMessage(error))
      }
    } finally {
      setBusy(null)
    }
  }

  async function handleDelete() {
    const customer = state.data
    if (!customer || customer.id === null) return

    const confirmed = window.confirm(
      `Deactivate customer "${customer.name ?? customer.id}"? This will set the customer to inactive.`,
    )
    if (!confirmed) return

    setBusy('delete')
    setActionError('')

    try {
      await deleteCustomer(customer.id)
      navigate('/customers')
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      if (!handleError(error)) {
        setActionError(actionErrorMessage(error))
      }
    } finally {
      setBusy(null)
    }
  }

  const customer = state.data

  return (
    <main className="dashboard-page">
      <PageHeader session={session} onLogout={onLogout} />
      <div className="dashboard-content">
        <div className="page-titlebar">
          <div>
            <p className="eyebrow">Customer management</p>
            <h1>Customer details</h1>
          </div>
          <div className="row-actions">
            <button type="button" className="btn" onClick={() => navigate('/customers')}>Back to list</button>
            {customer && (
              <>
                <button
                  type="button"
                  className="btn"
                  disabled={busy !== null}
                  onClick={() => navigate(`/customers/${customer.id}/edit`)}
                >
                  Edit
                </button>
                <button type="button" className="btn" disabled={busy !== null} onClick={() => void handleToggleStatus()}>
                  {customer.status === 1 ? 'Deactivate' : 'Activate'}
                </button>
                <button type="button" className="btn btn-danger" disabled={busy !== null} onClick={() => void handleDelete()}>
                  Delete
                </button>
              </>
            )}
          </div>
        </div>

        {actionError && (
          <div className="page-error" role="alert">
            {actionError}
          </div>
        )}

        {state.loading && <p className="panel-status" role="status">Loading…</p>}

        {state.error && (
          <section className="data-panel">
            <div className="panel-error" role="alert">
              <p>{state.error}</p>
            </div>
          </section>
        )}

        {!state.loading && !state.error && customer && (
          <section className="detail-card">
            <div className="panel-header">
              <h2>{customer.name ?? 'Unavailable'}</h2>
              <span className={`badge ${customer.status === 1 ? 'badge-active' : 'badge-inactive'}`}>
                {customer.status === 1 ? 'Active' : customer.status === 0 ? 'Inactive' : 'Unavailable'}
              </span>
            </div>
            <div className="detail-grid">
              <div className="detail-item">
                <span>Customer type</span>
                <strong>{customer.customerType === 'CORPORATE' ? 'Corporate' : 'Individual'}</strong>
              </div>
              <div className="detail-item">
                <span>Birthday</span>
                <strong>{customer.birthday ?? '—'}</strong>
              </div>
              <div className="detail-item">
                <span>Identity number</span>
                <strong>{customer.identityNo ?? '—'}</strong>
              </div>
              <div className="detail-item">
                <span>Mobile</span>
                <strong>{customer.mobile ?? '—'}</strong>
              </div>
              <div className="detail-item">
                <span>Address</span>
                <strong>{customer.address ?? '—'}</strong>
              </div>
              <div className="detail-item">
                <span>Version</span>
                <strong>{customer.version ?? '—'}</strong>
              </div>
              <div className="detail-item">
                <span>Created</span>
                <strong>{formatDateTime(customer.createDatetime)}</strong>
              </div>
              <div className="detail-item">
                <span>Updated</span>
                <strong>{formatDateTime(customer.updateDatetime)}</strong>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
