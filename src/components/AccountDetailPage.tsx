import { useCallback, useEffect, useState } from 'react'
import { approveAccount, closeAccount, freezeAccount, getAccount, rejectAccount, unfreezeAccount } from '../api/accounts'
import { HttpError } from '../api/http'
import type { Account } from '../api/types'
import type { Session } from '../auth/session'
import { accountStatusBadge, accountStatusLabel, formatMoney } from '../lib/accountStatus'
import { navigate } from '../lib/navigate'
import PageHeader from './PageHeader'

type State = {
  data: Account | null
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

function formatDateTime(value: string | null) {
  if (!value) {
    return '—'
  }
  return value.replace('T', ' ')
}

type AccountDetailPageProps = {
  id: number
  session: Session
  onUnauthorized: () => void
  onLogout: () => void
}

export default function AccountDetailPage({ id, session, onUnauthorized, onLogout }: AccountDetailPageProps) {
  const [state, setState] = useState<State>(initialState)
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState<'approve' | 'reject' | 'freeze' | 'unfreeze' | 'close' | null>(null)

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
    setState((current) => ({ ...current, error: '', loading: true }))
    getAccount(id, controller.signal)
      .then((data) => setState({ data, error: '', loading: false }))
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        if (!handleError(error)) {
          const message = error instanceof HttpError && error.code === 'ACCOUNT_NOT_FOUND'
            ? 'Account not found.'
            : errorMessage(error)
          setState({ data: null, error: message, loading: false })
        }
      })
    return () => controller.abort()
  }, [handleError, id])

  async function runTransition(
    type: 'approve' | 'reject' | 'freeze' | 'unfreeze' | 'close',
    confirmMessage?: string,
  ) {
    const account = state.data
    if (!account || account.id === null) return

    if (confirmMessage && !window.confirm(confirmMessage)) {
      return
    }

    setBusy(type)
    setActionError('')

    try {
      const updated = type === 'approve'
        ? await approveAccount(account.id)
        : type === 'reject'
          ? await rejectAccount(account.id)
          : type === 'freeze'
            ? await freezeAccount(account.id)
            : type === 'unfreeze'
              ? await unfreezeAccount(account.id)
              : await closeAccount(account.id)
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

  const account = state.data

  return (
    <main className="dashboard-page">
      <PageHeader session={session} onLogout={onLogout} />
      <div className="dashboard-content">
        <div className="page-titlebar">
          <div>
            <p className="eyebrow">Account management</p>
            <h1>Account details</h1>
          </div>
          <button type="button" className="btn" onClick={() => navigate('/accounts')}>Back to list</button>
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

        {!state.loading && !state.error && account && (
          <section className="detail-card">
            <div className="panel-header">
              <h2>{account.accountNumber ?? 'Unavailable'}</h2>
              <span className={`badge ${accountStatusBadge(account.status)}`}>
                {accountStatusLabel(account.status)}
              </span>
            </div>
            <div className="detail-grid">
              <div className="detail-item">
                <span>Account number</span>
                <strong>{account.accountNumber ?? '—'}</strong>
              </div>
              <div className="detail-item">
                <span>Balance</span>
                <strong>{formatMoney(account.balance)}</strong>
              </div>
              <div className="detail-item">
                <span>Customer</span>
                <strong>
                  {account.customerId !== null ? (
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => navigate(`/customers/${account.customerId}`)}
                    >
                      {account.customerName ?? account.customerId}
                    </button>
                  ) : (
                    '—'
                  )}
                </strong>
              </div>
              <div className="detail-item">
                <span>Customer ID</span>
                <strong>{account.customerId ?? '—'}</strong>
              </div>
              <div className="detail-item">
                <span>Created</span>
                <strong>{formatDateTime(account.createDatetime)}</strong>
              </div>
              <div className="detail-item">
                <span>Updated</span>
                <strong>{formatDateTime(account.updateDatetime)}</strong>
              </div>
            </div>
            <div className="form-actions">
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy !== null}
                onClick={() => navigate('/transactions/transfer')}
              >
                Transfer
              </button>
              <button
                type="button"
                className="btn"
                disabled={busy !== null}
                onClick={() => account.accountNumber && navigate(`/transactions/history/${account.accountNumber}`)}
              >
                Transactions
              </button>
              {canApprove && account.status === 3 && (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy !== null}
                  onClick={() => void runTransition('approve')}
                >
                  Approve
                </button>
              )}
              {canReject && account.status === 3 && (
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={busy !== null}
                  onClick={() =>
                    void runTransition(
                      'reject',
                      `Reject account "${account.accountNumber}"? This will set the account to inactive.`,
                    )
                  }
                >
                  Reject
                </button>
              )}
              {canFreeze && account.status === 1 && (
                <button
                  type="button"
                  className="btn"
                  disabled={busy !== null}
                  onClick={() => void runTransition('freeze')}
                >
                  Freeze
                </button>
              )}
              {canUnfreeze && account.status === 2 && (
                <button
                  type="button"
                  className="btn"
                  disabled={busy !== null}
                  onClick={() => void runTransition('unfreeze')}
                >
                  Unfreeze
                </button>
              )}
              {canClose && account.status === 1 && (
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={busy !== null}
                  onClick={() =>
                    void runTransition(
                      'close',
                      `Close account "${account.accountNumber}"? This can only be done when the balance is zero.`,
                    )
                  }
                >
                  Close
                </button>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}