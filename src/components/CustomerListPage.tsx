import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { deleteCustomer, getCustomers, updateCustomerStatus } from '../api/customers'
import { HttpError } from '../api/http'
import type { Customer, CustomerSearchFilters, CustomerType, PageResponse } from '../api/types'
import type { Session } from '../auth/session'
import { navigate } from '../lib/navigate'
import PageHeader from './PageHeader'

const PAGE_SIZE = 10

type PageState = {
  data: PageResponse<Customer> | null
  error: string
  loading: boolean
}

const initialPageState: PageState = { data: null, error: '', loading: true }

type FieldErrors = {
  name?: string
  identityNo?: string
  mobile?: string
}

type BusyAction = { id: number; type: 'status' | 'delete' } | null

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

function customerTypeLabel(type: Customer['customerType']) {
  return type === 'CORPORATE' ? 'Corporate' : type === 'INDIVIDUAL' ? 'Individual' : 'Unavailable'
}

function statusLabel(status: Customer['status']) {
  return status === 1 ? 'Active' : status === 0 ? 'Inactive' : 'Unavailable'
}

type CustomerListPageProps = {
  session: Session
  onUnauthorized: () => void
  onLogout: () => void
}

export default function CustomerListPage({ session, onUnauthorized, onLogout }: CustomerListPageProps) {
  const [page, setPage] = useState(0)
  const [reloadKey, setReloadKey] = useState(0)
  const [appliedFilters, setAppliedFilters] = useState<CustomerSearchFilters>({})
  const [draft, setDraft] = useState<CustomerSearchFilters>({})
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [pageState, setPageState] = useState<PageState>(initialPageState)
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState<BusyAction>(null)

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
    setPageState((current) => ({ ...current, error: '', loading: true }))
    getCustomers(page, PAGE_SIZE, appliedFilters, controller.signal)
      .then((data) => setPageState({ data, error: '', loading: false }))
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        if (!handleError(error)) {
          setPageState((current) => ({ ...current, error: errorMessage(error), loading: false }))
        }
      })
    return () => controller.abort()
  }, [appliedFilters, handleError, page, reloadKey])

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const errors: FieldErrors = {}
    if (draft.name && draft.name.length > 100) {
      errors.name = 'Name must be 100 characters or fewer.'
    }
    if (draft.identityNo && !/^\d{10}$/.test(draft.identityNo)) {
      errors.identityNo = 'Identity number must be 10 digits.'
    }
    if (draft.mobile && !/^\d{9,10}$/.test(draft.mobile)) {
      errors.mobile = 'Mobile must be 9–10 digits.'
    }
    setFieldErrors(errors)

    if (Object.keys(errors).length > 0) {
      return
    }

    setPage(0)
    setAppliedFilters({ ...draft })
    setActionError('')
  }

  function handleReset() {
    setDraft({})
    setFieldErrors({})
    setPage(0)
    setAppliedFilters({})
    setActionError('')
  }

  async function handleToggleStatus(customer: Customer) {
    if (customer.id === null) return

    const nextStatus = customer.status === 1 ? 0 : 1
    setBusy({ id: customer.id, type: 'status' })
    setActionError('')

    try {
      await updateCustomerStatus(customer.id, nextStatus)
      setReloadKey((key) => key + 1)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      if (!handleError(error)) {
        setActionError(actionErrorMessage(error))
      }
    } finally {
      setBusy(null)
    }
  }

  async function handleDelete(customer: Customer) {
    if (customer.id === null) return

    const confirmed = window.confirm(
      `Deactivate customer "${customer.name ?? customer.id}"? This will set the customer to inactive.`,
    )
    if (!confirmed) return

    setBusy({ id: customer.id, type: 'delete' })
    setActionError('')

    try {
      await deleteCustomer(customer.id)
      const current = pageState.data
      if (current && current.content.length === 1 && current.pageNumber > 0) {
        setPage(current.pageNumber - 1)
      } else {
        setReloadKey((key) => key + 1)
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      if (!handleError(error)) {
        setActionError(actionErrorMessage(error))
      }
    } finally {
      setBusy(null)
    }
  }

  return (
    <main className="dashboard-page">
      <PageHeader session={session} onLogout={onLogout} />
      <div className="dashboard-content">
        <div className="page-titlebar">
          <div>
            <p className="eyebrow">Customer management</p>
            <h1>Customers</h1>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/customers/new')}>
            New customer
          </button>
        </div>

        <form className="filters" onSubmit={handleSearchSubmit}>
          <div className="form-field">
            <label htmlFor="filter-name">Name</label>
            <input
              id="filter-name"
              type="text"
              maxLength={100}
              value={draft.name ?? ''}
              aria-invalid={Boolean(fieldErrors.name)}
              onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value || undefined }))}
            />
            {fieldErrors.name && <span className="field-error">{fieldErrors.name}</span>}
          </div>
          <div className="form-field">
            <label htmlFor="filter-identity-no">Identity No</label>
            <input
              id="filter-identity-no"
              type="text"
              inputMode="numeric"
              maxLength={10}
              value={draft.identityNo ?? ''}
              aria-invalid={Boolean(fieldErrors.identityNo)}
              onChange={(event) => setDraft((current) => ({ ...current, identityNo: event.target.value || undefined }))}
            />
            {fieldErrors.identityNo && <span className="field-error">{fieldErrors.identityNo}</span>}
          </div>
          <div className="form-field">
            <label htmlFor="filter-mobile">Mobile</label>
            <input
              id="filter-mobile"
              type="text"
              inputMode="numeric"
              maxLength={10}
              value={draft.mobile ?? ''}
              aria-invalid={Boolean(fieldErrors.mobile)}
              onChange={(event) => setDraft((current) => ({ ...current, mobile: event.target.value || undefined }))}
            />
            {fieldErrors.mobile && <span className="field-error">{fieldErrors.mobile}</span>}
          </div>
          <div className="form-field">
            <label htmlFor="filter-type">Type</label>
            <select
              id="filter-type"
              value={draft.customerType ?? ''}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  customerType: event.target.value === '' ? undefined : (event.target.value as CustomerType),
                }))
              }
            >
              <option value="">Any</option>
              <option value="INDIVIDUAL">Individual</option>
              <option value="CORPORATE">Corporate</option>
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="filter-status">Status</label>
            <select
              id="filter-status"
              value={draft.status === undefined ? '' : String(draft.status)}
              onChange={(event) => {
                const value = event.target.value
                setDraft((current) => ({ ...current, status: value === '' ? undefined : Number(value) }))
              }}
            >
              <option value="">Any</option>
              <option value="1">Active</option>
              <option value="0">Inactive</option>
            </select>
          </div>
          <div className="filter-actions">
            <button type="submit" className="btn btn-primary">Search</button>
            <button type="button" className="btn" onClick={handleReset}>Reset</button>
          </div>
        </form>

        {actionError && (
          <div className="page-error" role="alert">
            {actionError}
          </div>
        )}

        <section className="data-panel">
          <div className="panel-header">
            <h2>Customer list</h2>
            <span>{pageState.data ? `${pageState.data.totalElements} result${pageState.data.totalElements === 1 ? '' : 's'}` : ''}</span>
          </div>
          {pageState.loading && <p className="panel-status" role="status">Loading…</p>}
          {pageState.error && (
            <div className="panel-error" role="alert">
              <p>{pageState.error}</p>
              <button type="button" onClick={() => setReloadKey((key) => key + 1)}>Retry</button>
            </div>
          )}
          {!pageState.loading && !pageState.error && pageState.data && (
            pageState.data.content.length === 0 ? (
              <p className="panel-status">No customers found.</p>
            ) : (
              <>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr><th>Name</th><th>Type</th><th>Status</th><th>Mobile</th><th>Identity No</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                      {pageState.data.content.map((customer) => (
                        <tr key={customer.id}>
                          <td>{customer.name ?? 'Unavailable'}</td>
                          <td>{customerTypeLabel(customer.customerType)}</td>
                          <td>
                            <span className={`badge ${customer.status === 1 ? 'badge-active' : 'badge-inactive'}`}>
                              {statusLabel(customer.status)}
                            </span>
                          </td>
                          <td>{customer.mobile ?? '—'}</td>
                          <td>{customer.identityNo ?? '—'}</td>
                          <td>
                            <div className="row-actions">
                              <button
                                type="button"
                                className="btn"
                                onClick={() => customer.id !== null && navigate(`/customers/${customer.id}`)}
                              >
                                View
                              </button>
                              <button
                                type="button"
                                className="btn"
                                onClick={() => customer.id !== null && navigate(`/customers/${customer.id}/edit`)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="btn"
                                disabled={busy?.id === customer.id}
                                onClick={() => void handleToggleStatus(customer)}
                              >
                                {customer.status === 1 ? 'Deactivate' : 'Activate'}
                              </button>
                              <button
                                type="button"
                                className="btn btn-danger"
                                disabled={busy?.id === customer.id}
                                onClick={() => void handleDelete(customer)}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="pagination">
                  <span>
                    Page {pageState.data.pageNumber + 1} of {pageState.data.totalPages}
                  </span>
                  <div>
                    <button
                      type="button"
                      className="btn"
                      disabled={pageState.data.pageNumber === 0}
                      onClick={() => setPage((current) => current - 1)}
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      className="btn"
                      disabled={pageState.data.last}
                      onClick={() => setPage((current) => current + 1)}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            )
          )}
        </section>
      </div>
    </main>
  )
}
