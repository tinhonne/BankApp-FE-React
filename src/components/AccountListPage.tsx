import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import {
  approveAccount,
  closeAccount,
  freezeAccount,
  getAccountByNumber,
  getAccounts,
  rejectAccount,
  unfreezeAccount,
} from '../api/accounts'
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

type LookupState = {
  number: string
  account: Account | null
  error: string
  loading: boolean
}

const initialLookupState: LookupState = { number: '', account: null, error: '', loading: false }

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

type AccountActionsProps = {
  account: Account
  busyId: number | null
  canApprove: boolean
  canReject: boolean
  canFreeze: boolean
  canUnfreeze: boolean
  canClose: boolean
  onApprove: (account: Account) => void
  onReject: (account: Account) => void
  onFreeze: (account: Account) => void
  onUnfreeze: (account: Account) => void
  onClose: (account: Account) => void
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
      title={copied ? 'Copied' : `Copy ${text}`}
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

function AccountRow({
  account,
  busyId,
  canApprove,
  canReject,
  canFreeze,
  canUnfreeze,
  canClose,
  onApprove,
  onReject,
  onFreeze,
  onUnfreeze,
  onClose,
}: AccountActionsProps) {
  const isBusy = busyId === account.id

  return (
    <tr key={account.id}>
      <td>
        <span className="account-cell tabular-nums">
          {account.accountNumber ?? 'Unavailable'}
          {account.accountNumber && <CopyBtn text={account.accountNumber} />}
        </span>
      </td>
      <td>{account.customerName ?? '—'}</td>
      <td className="td-right tabular-nums font-semibold">{formatMoney(account.balance)}</td>
      <td>
        <span className={`badge ${accountStatusBadge(account.status)}`}>
          {accountStatusLabel(account.status)}
        </span>
      </td>
      <td className="tabular-nums">{(account.createDatetime ?? '—').replace('T', ' ')}</td>
      <td>
        <div className="row-actions">
          <button
            type="button"
            className="btn"
            onClick={() => account.id !== null && navigate(`/accounts/${account.id}`)}
          >
            View
          </button>
          {account.accountNumber && (
            <button
              type="button"
              className="btn"
              title="View transaction history"
              onClick={() => navigate(`/transactions/history/${account.accountNumber}`)}
            >
              Txns
            </button>
          )}
          {canApprove && account.status === 3 && (
            <button type="button" className="btn btn-primary" disabled={isBusy} onClick={() => onApprove(account)}>
              Approve
            </button>
          )}
          {canReject && account.status === 3 && (
            <button type="button" className="btn btn-danger" disabled={isBusy} onClick={() => onReject(account)}>
              Reject
            </button>
          )}
          {canFreeze && account.status === 1 && (
            <button type="button" className="btn" disabled={isBusy} onClick={() => onFreeze(account)}>
              Freeze
            </button>
          )}
          {canUnfreeze && account.status === 2 && (
            <button type="button" className="btn" disabled={isBusy} onClick={() => onUnfreeze(account)}>
              Unfreeze
            </button>
          )}
          {canClose && account.status === 1 && (
            <button type="button" className="btn btn-danger" disabled={isBusy} onClick={() => onClose(account)}>
              Close
            </button>
          )}
        </div>
      </td>
    </tr>
  )
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
  const [lookupNumber, setLookupNumber] = useState('')
  const [lookupFieldError, setLookupFieldError] = useState('')
  const [lookup, setLookup] = useState<LookupState>(initialLookupState)
  const lookupController = useRef<AbortController | null>(null)

  const canApprove = session.roles.includes('MANAGER')
  const canReject = session.roles.includes('MANAGER')
  const canFreeze = session.roles.includes('MANAGER')
  const canUnfreeze = session.roles.includes('MANAGER')
  const canClose = session.roles.includes('MANAGER')

  const searchMode = lookup.number !== ''

  useEffect(() => () => lookupController.current?.abort(), [])

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

  async function runLookup(number: string) {
    lookupController.current?.abort()
    const controller = new AbortController()
    lookupController.current = controller
    setLookup({ number, account: null, error: '', loading: true })
    try {
      const account = await getAccountByNumber(number, controller.signal)
      setLookup({ number, account, error: '', loading: false })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      if (!handleError(error)) {
        const message = error instanceof HttpError && error.code === 'ACCOUNT_NOT_FOUND'
          ? `Account "${number}" was not found.`
          : errorMessage(error)
        setLookup({ number, account: null, error: message, loading: false })
      }
    }
  }

  function handleLookupSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const number = lookupNumber.trim()
    if (!/^\d{13}$/.test(number)) {
      setLookupFieldError('Account number must be exactly 13 digits.')
      return
    }
    setLookupFieldError('')
    setActionError('')
    void runLookup(number)
  }

  function clearLookup() {
    lookupController.current?.abort()
    setLookup(initialLookupState)
    setLookupNumber('')
    setLookupFieldError('')
    setActionError('')
  }

  function afterAction(updated: Account) {
    setReloadKey((key) => key + 1)
    setLookup((current) => (current.number === '' ? current : { ...current, account: updated }))
  }

  async function handleApprove(account: Account) {
    if (account.id === null) return
    setBusy({ id: account.id, type: 'approve' })
    setActionError('')
    try {
      const updated = await approveAccount(account.id)
      afterAction(updated)
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
      const updated = await rejectAccount(account.id)
      afterAction(updated)
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
      const updated = await freezeAccount(account.id)
      afterAction(updated)
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
      const updated = await unfreezeAccount(account.id)
      afterAction(updated)
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
      const updated = await closeAccount(account.id)
      afterAction(updated)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      if (!handleError(error)) {
        setActionError(actionErrorMessage(error))
      }
    } finally {
      setBusy(null)
    }
  }

  const actionsProps = {
    busyId: busy?.id ?? null,
    canApprove,
    canReject,
    canFreeze,
    canUnfreeze,
    canClose,
    onApprove: (account: Account) => void handleApprove(account),
    onReject: (account: Account) => void handleReject(account),
    onFreeze: (account: Account) => void handleFreeze(account),
    onUnfreeze: (account: Account) => void handleUnfreeze(account),
    onClose: (account: Account) => void handleClose(account),
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

        <form className="lookup-bar" onSubmit={handleLookupSubmit}>
          <input
            type="text"
            inputMode="numeric"
            maxLength={13}
            placeholder="Enter exact 13-digit account number"
            value={lookupNumber}
            aria-invalid={Boolean(lookupFieldError)}
            onChange={(event) => {
              setLookupNumber(event.target.value)
              setLookupFieldError('')
              setActionError('')
            }}
          />
          <button type="submit" className="btn btn-primary">Find account</button>
          {searchMode && (
            <button type="button" className="btn" onClick={clearLookup}>Clear</button>
          )}
          {lookupFieldError && <span className="field-error lookup-error">{lookupFieldError}</span>}
        </form>

        {actionError && (
          <div className="page-error" role="alert">
            {actionError}
          </div>
        )}

        {searchMode ? (
          <section className="data-panel">
            <div className="panel-header">
              <h2>Account search result</h2>
              <span>{lookup.number}</span>
            </div>
            {lookup.loading && <p className="panel-status" role="status">Loading…</p>}
            {lookup.error && (
              <div className="panel-error" role="alert">
                <p>{lookup.error}</p>
                <button type="button" onClick={clearLookup}>Back to list</button>
              </div>
            )}
            {!lookup.loading && !lookup.error && lookup.account && (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr><th>Account No</th><th>Customer</th><th className="th-right">Balance</th><th>Status</th><th>Created</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    <AccountRow account={lookup.account} {...actionsProps} />
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : (
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
                        <tr><th>Account No</th><th>Customer</th><th className="th-right">Balance</th><th>Status</th><th>Created</th><th>Actions</th></tr>
                      </thead>
                      <tbody>
                        {pageState.data.content.map((account) => (
                          <AccountRow key={account.id} account={account} {...actionsProps} />
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
        )}
      </div>
    </main>
  )
}