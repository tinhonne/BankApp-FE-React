import { useCallback, useEffect, useState } from 'react'
import { getCustomerAccounts } from '../api/accounts'
import { deleteCustomer, getCustomer, updateCustomerStatus } from '../api/customers'
import { HttpError } from '../api/http'
import type { Account, Customer, PageResponse } from '../api/types'
import type { Session } from '../auth/session'
import { accountStatusBadge, accountStatusLabel, formatMoney } from '../lib/accountStatus'
import { navigate } from '../lib/navigate'
import PageHeader from './PageHeader'

type State = {
  data: Customer | null
  error: string
  loading: boolean
}

const initialState: State = { data: null, error: '', loading: true }

type AccountsState = {
  data: PageResponse<Account> | null
  error: string
  loading: boolean
}

const initialAccountsState: AccountsState = { data: null, error: '', loading: true }

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

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!navigator.clipboard) return
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }

  return (
    <button
      type="button"
      className="copy-btn"
      onClick={handleCopy}
      title={copied ? 'Copied to clipboard' : `Copy ${text}`}
      aria-label={copied ? 'Copied' : `Copy ${text}`}
    >
      {copied ? (
        <span className="copy-btn-success" aria-hidden="true">✓</span>
      ) : (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  )
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
  const [accountsState, setAccountsState] = useState<AccountsState>(initialAccountsState)

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

  useEffect(() => {
    const controller = new AbortController()
    setAccountsState((current) => ({ ...current, error: '', loading: true }))
    getCustomerAccounts(id, 0, 50, controller.signal)
      .then((data) => setAccountsState({ data, error: '', loading: false }))
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        if (!handleError(error)) {
          setAccountsState({ data: null, error: errorMessage(error), loading: false })
        }
      })
    return () => controller.abort()
  }, [handleError, id])

  async function handleToggleStatus() {
    const customer = state.data
    if (!customer || customer.id === null) return

    const nextStatus = customer.status === 1 ? 0 : 1
    const confirmPrompt =
      nextStatus === 0
        ? `Deactivate customer "${customer.name ?? customer.id}"? They will not be able to perform account operations.`
        : `Activate customer "${customer.name ?? customer.id}"?`

    if (!window.confirm(confirmPrompt)) return

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
  const canManageAccounts = session.roles.includes('EMPLOYEE') || session.roles.includes('MANAGER')

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
              <span className="breadcrumb-current">{customer?.name ?? id}</span>
            </div>
            <h1>Customer details</h1>
          </div>
          <div className="row-actions">
            <button type="button" className="btn" onClick={() => navigate('/customers')}>
              Back to list
            </button>
            {customer && (
              <>
                {canManageAccounts && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy !== null || customer.status !== 1}
                    title={customer.status !== 1 ? 'Cannot open account for inactive customer' : 'Open a new bank account for this customer'}
                    onClick={() => navigate(`/accounts/new?customerId=${customer.id}`)}
                  >
                    Open account
                  </button>
                )}
                <button
                  type="button"
                  className="btn"
                  disabled={busy !== null}
                  onClick={() => navigate(`/customers/${customer.id}/edit`)}
                >
                  Edit profile
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={busy !== null}
                  onClick={() => void handleToggleStatus()}
                >
                  {customer.status === 1 ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={busy !== null}
                  onClick={() => void handleDelete()}
                >
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

        {state.loading && (
          <div className="panel-status-box" role="status">
            <div className="loading-spinner" aria-hidden="true" />
            <p>Loading customer profile…</p>
          </div>
        )}

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
                <span>Customer Type</span>
                <strong>{customer.customerType === 'CORPORATE' ? 'Corporate' : 'Individual'}</strong>
              </div>
              <div className="detail-item">
                <span>Birthday</span>
                <strong className="tabular-nums">{customer.birthday ?? '—'}</strong>
              </div>
              <div className="detail-item">
                <span>Identity Number</span>
                <strong className="account-cell tabular-nums">
                  {customer.identityNo ?? '—'}
                  {customer.identityNo && <CopyBtn text={customer.identityNo} />}
                </strong>
              </div>
              <div className="detail-item">
                <span>Mobile</span>
                <strong className="tabular-nums">{customer.mobile ?? '—'}</strong>
              </div>
              <div className="detail-item detail-item-full">
                <span>Registered Address</span>
                <strong>{customer.address ?? '—'}</strong>
              </div>
              <div className="detail-item">
                <span>Record Version</span>
                <strong className="tabular-nums">v{customer.version ?? '—'}</strong>
              </div>
              <div className="detail-item">
                <span>Created Date</span>
                <strong className="tabular-nums">{formatDateTime(customer.createDatetime)}</strong>
              </div>
              <div className="detail-item">
                <span>Last Updated</span>
                <strong className="tabular-nums">{formatDateTime(customer.updateDatetime)}</strong>
              </div>
            </div>
          </section>
        )}

        {!state.loading && !state.error && accountsState.data && (
          <section className="data-panel accounts-panel">
            <div className="panel-header">
              <div>
                <h2>Associated Accounts</h2>
                <span className="panel-subtitle">Active accounts owned by this customer</span>
              </div>
              <div className="row-actions" style={{ alignItems: 'center' }}>
                <span>{accountsState.data.totalElements} result{accountsState.data.totalElements === 1 ? '' : 's'}</span>
                {canManageAccounts && customer && customer.status === 1 && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => navigate(`/accounts/new?customerId=${customer.id}`)}
                  >
                    + Open account
                  </button>
                )}
              </div>
            </div>
            {accountsState.loading && <p className="panel-status" role="status">Loading accounts…</p>}
            {accountsState.error && (
              <div className="panel-error" role="alert">
                <p>{accountsState.error}</p>
              </div>
            )}
            {!accountsState.loading && !accountsState.error && (
              accountsState.data.content.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '28px 16px' }}>
                  <p className="panel-status" style={{ margin: '0 0 16px 0' }}>No active accounts associated with this customer.</p>
                  {canManageAccounts && customer && customer.status === 1 && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => navigate(`/accounts/new?customerId=${customer.id}`)}
                    >
                      Open an account
                    </button>
                  )}
                </div>
              ) : (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Account No</th>
                        <th className="th-right">Balance</th>
                        <th>Status</th>
                        <th>Created Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accountsState.data.content.map((account) => (
                        <tr
                          key={account.id}
                          className="clickable-row"
                          onClick={() => account.id !== null && navigate(`/accounts/${account.id}`)}
                        >
                          <td>
                            <span className="account-num tabular-nums">{account.accountNumber ?? 'Unavailable'}</span>
                          </td>
                          <td className="td-right tabular-nums font-semibold">{formatMoney(account.balance)}</td>
                          <td>
                            <span className={`badge ${accountStatusBadge(account.status)}`}>
                              {accountStatusLabel(account.status)}
                            </span>
                          </td>
                          <td className="tabular-nums">{formatDateTime(account.createDatetime)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </section>
        )}
      </div>
    </main>
  )
}
