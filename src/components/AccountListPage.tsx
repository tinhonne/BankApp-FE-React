import { useCallback, useEffect, useState } from 'react'
import { approveAccount, closeAccount, freezeAccount, getAccounts, rejectAccount, unfreezeAccount } from '../api/accounts'
import { HttpError } from '../api/http'
import type { Account, PageResponse } from '../api/types'
import type { Session } from '../auth/session'
import { accountStatusBadge, accountStatusLabel, formatMoney } from '../lib/accountStatus'
import { navigate } from '../lib/navigate'
import PageHeader from './PageHeader'

const PAGE_SIZE = 10

type PageState = {
  data: PageResponse<Account> | null
  error: string
  loading: boolean
}

const initialPageState: PageState = { data: null, error: '', loading: true }

type BusyAction = { id: number; type: 'approve' | 'reject' | 'freeze' | 'unfreeze' | 'close' } | null

function errorMessage(error: unknown) {
  if (error instanceof HttpError) {
    return error.message
  }

  return 'Unable to load this information.'
}

function actionErrorMessage(error: unknown) {
  if (error instanceof HttpError) {
    if (error.code === 'ACCOUNT_NOT_FOUND') {
      return 'Account not found.'
    }
    if (error.code === 'ACCOUNT_NOT_PENDING_APPROVAL') {
      return 'Account is not pending approval.'
    }
    if (error.code === 'INVALID_ACCOUNT_STATUS') {
      return 'The requested status change is not allowed for this account.'
    }
    if (error.code === 'ACCOUNT_BALANCE_NOT_ZERO') {
      return 'Account must have a zero balance to be closed.'
    }
    if (error.code === 'CUSTOMER_INACTIVE') {
      return 'The customer is inactive and this action cannot be completed.'
    }
    if (error.code === 'FORBIDDEN') {
      return 'You are not authorized to perform this action.'
    }
    return error.message
  }

  return 'The operation could not be completed. Please try again.'
}

type AccountListPageProps = {
  session: Session
  onUnauthorized: () => void
  onLogout: () => void
}

export default function AccountListPage({ session, onUnauthorized, onLogout }: AccountListPageProps) {
  const [page, setPage] = useState(0)
  const [reloadKey, setReloadKey] = useState(0)
  const [pageState, setPageState] = useState<PageState>(initialPageState)
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState<BusyAction>(null)

  const canApprove = session.roles.includes('MANAGER')
  const canReject = session.roles.includes('MANAGER')
  const canFreeze = session.roles.includes('MANAGER')
  const canUnfreeze = session.roles.includes('MANAGER')
  const canClose = session.roles.includes('MANAGER')

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
    getAccounts(page, PAGE_SIZE, controller.signal)
      .then((data) => setPageState({ data, error: '', loading: false }))
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        if (!handleError(error)) {
          setPageState((current) => ({ ...current, error: errorMessage(error), loading: false }))
        }
      })
    return () => controller.abort()
  }, [handleError, page, reloadKey])

  async function handleApprove(account: Account) {
    if (account.id === null) return
    setBusy({ id: account.id, type: 'approve' })
    setActionError('')
    try {
      await approveAccount(account.id)
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

  async function handleReject(account: Account) {
    if (account.id === null) return
    const confirmed = window.confirm(
      `Reject account "${account.accountNumber}"? This will set the account to inactive.`,
    )
    if (!confirmed) return
    setBusy({ id: account.id, type: 'reject' })
    setActionError('')
    try {
      await rejectAccount(account.id)
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

  async function handleFreeze(account: Account) {
    if (account.id === null) return
    setBusy({ id: account.id, type: 'freeze' })
    setActionError('')
    try {
      await freezeAccount(account.id)
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

  async function handleUnfreeze(account: Account) {
    if (account.id === null) return
    setBusy({ id: account.id, type: 'unfreeze' })
    setActionError('')
    try {
      await unfreezeAccount(account.id)
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

  async function handleClose(account: Account) {
    if (account.id === null) return
    const confirmed = window.confirm(
      `Close account "${account.accountNumber}"? This can only be done when the balance is zero.`,
    )
    if (!confirmed) return
    setBusy({ id: account.id, type: 'close' })
    setActionError('')
    try {
      await closeAccount(account.id)
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

  return (
    <main className="dashboard-page">
      <PageHeader session={session} onLogout={onLogout} />
      <div className="dashboard-content">
        <div className="page-titlebar">
          <div>
            <p className="eyebrow">Account management</p>
            <h1>Accounts</h1>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/accounts/new')}>
            New account
          </button>
        </div>

        {actionError && (
          <div className="page-error" role="alert">
            {actionError}
          </div>
        )}

        <section className="data-panel">
          <div className="panel-header">
            <h2>Account list</h2>
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
              <p className="panel-status">No accounts found.</p>
            ) : (
              <>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr><th>Account No</th><th>Customer</th><th>Balance</th><th>Status</th><th>Created</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                      {pageState.data.content.map((account) => {
                        const isBusy = busy?.id === account.id
                        return (
                          <tr key={account.id}>
                            <td>{account.accountNumber ?? 'Unavailable'}</td>
                            <td>{account.customerName ?? '—'}</td>
                            <td>{formatMoney(account.balance)}</td>
                            <td>
                              <span className={`badge ${accountStatusBadge(account.status)}`}>
                                {accountStatusLabel(account.status)}
                              </span>
                            </td>
                            <td>{(account.createDatetime ?? '—').replace('T', ' ')}</td>
                            <td>
                              <div className="row-actions">
                                <button
                                  type="button"
                                  className="btn"
                                  onClick={() => account.id !== null && navigate(`/accounts/${account.id}`)}
                                >
                                  View
                                </button>
                                {canApprove && account.status === 3 && (
                                  <button
                                    type="button"
                                    className="btn"
                                    disabled={isBusy}
                                    onClick={() => void handleApprove(account)}
                                  >
                                    Approve
                                  </button>
                                )}
                                {canReject && account.status === 3 && (
                                  <button
                                    type="button"
                                    className="btn btn-danger"
                                    disabled={isBusy}
                                    onClick={() => void handleReject(account)}
                                  >
                                    Reject
                                  </button>
                                )}
                                {canFreeze && account.status === 1 && (
                                  <button
                                    type="button"
                                    className="btn"
                                    disabled={isBusy}
                                    onClick={() => void handleFreeze(account)}
                                  >
                                    Freeze
                                  </button>
                                )}
                                {canUnfreeze && account.status === 2 && (
                                  <button
                                    type="button"
                                    className="btn"
                                    disabled={isBusy}
                                    onClick={() => void handleUnfreeze(account)}
                                  >
                                    Unfreeze
                                  </button>
                                )}
                                {canClose && account.status === 1 && (
                                  <button
                                    type="button"
                                    className="btn btn-danger"
                                    disabled={isBusy}
                                    onClick={() => void handleClose(account)}
                                  >
                                    Close
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
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