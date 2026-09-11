import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { HttpError } from '../api/http'
import { getTransactions } from '../api/transactions'
import type { PageResponse, Transaction } from '../api/types'
import type { Session } from '../auth/session'
import { formatMoney } from '../lib/accountStatus'
import { formatDateTime, transactionStatusInfo } from '../lib/transactionStatus'
import { navigate } from '../lib/navigate'
import PageHeader from './PageHeader'

const PAGE_SIZE = 10

type HistoryState = {
  data: PageResponse<Transaction> | null
  error: string
  loading: boolean
}

const initialHistoryState: HistoryState = { data: null, error: '', loading: true }

type DateFilters = {
  fromDate?: string
  toDate?: string
}

type AppliedFilters = {
  fromDateTime?: string
  toDateTime?: string
}

function errorMessage(error: unknown) {
  if (error instanceof HttpError) {
    return error.message
  }

  return 'Unable to load this information.'
}

function toIsoDateTime(date: string, endOfDay: boolean) {
  return endOfDay ? `${date}T23:59:59` : `${date}T00:00:00`
}

function direction(transaction: Transaction, accountNumber: string) {
  if (transaction.fromAccountNumber === accountNumber) {
    return { label: 'Outflow', isOutflow: true, className: 'tx-direction-outflow' }
  }
  if (transaction.toAccountNumber === accountNumber) {
    return { label: 'Inflow', isOutflow: false, className: 'tx-direction-inflow' }
  }
  return { label: '—', isOutflow: false, className: '' }
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

type TransactionHistoryPageProps = {
  accountNumber: string
  session: Session
  onUnauthorized: () => void
  onLogout: () => void
}

export default function TransactionHistoryPage({
  accountNumber,
  session,
  onUnauthorized,
  onLogout,
}: TransactionHistoryPageProps) {
  const [page, setPage] = useState(0)
  const [reloadKey, setReloadKey] = useState(0)
  const [appliedFilters, setAppliedFilters] = useState<AppliedFilters>({})
  const [draft, setDraft] = useState<DateFilters>({})
  const [filterError, setFilterError] = useState('')
  const [state, setState] = useState<HistoryState>(initialHistoryState)

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
    getTransactions(
      accountNumber,
      appliedFilters.fromDateTime,
      appliedFilters.toDateTime,
      page,
      PAGE_SIZE,
      controller.signal,
    )
      .then((data) => setState({ data, error: '', loading: false }))
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        if (!handleError(error)) {
          setState((current) => ({ ...current, error: errorMessage(error), loading: false }))
        }
      })
    return () => controller.abort()
  }, [accountNumber, appliedFilters, handleError, page, reloadKey])

  function handleApplyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const fromDate = draft.fromDate
    const toDate = draft.toDate
    if (fromDate && toDate && fromDate > toDate) {
      setFilterError('From date cannot be after to date.')
      return
    }

    setFilterError('')
    setPage(0)
    setAppliedFilters({
      fromDateTime: fromDate ? toIsoDateTime(fromDate, false) : undefined,
      toDateTime: toDate ? toIsoDateTime(toDate, true) : undefined,
    })
  }

  function handleResetFilters() {
    setDraft({})
    setFilterError('')
    setPage(0)
    setAppliedFilters({})
  }

  const hasFilters = Boolean(appliedFilters.fromDateTime || appliedFilters.toDateTime)

  return (
    <main className="dashboard-page">
      <PageHeader session={session} onLogout={onLogout} />
      <div className="dashboard-content">
        <div className="page-titlebar">
          <div>
            <div className="breadcrumbs">
              <button type="button" className="breadcrumb-link" onClick={() => navigate('/accounts')}>
                Accounts
              </button>
              <span className="breadcrumb-separator" aria-hidden="true">/</span>
              <button type="button" className="breadcrumb-link" onClick={() => navigate(`/accounts/${accountNumber}`)}>
                {accountNumber}
              </button>
              <span className="breadcrumb-separator" aria-hidden="true">/</span>
              <span className="breadcrumb-current">Transactions</span>
            </div>
            <h1>Transaction history</h1>
          </div>
          <div className="row-actions">
            <button type="button" className="btn" onClick={() => navigate(`/accounts/${accountNumber}`)}>
              View account
            </button>
            <button type="button" className="btn" onClick={() => navigate('/accounts')}>
              Back to accounts
            </button>
          </div>
        </div>

        <form className="filters" onSubmit={handleApplyFilters}>
          <div className="form-field">
            <label htmlFor="filter-from">From date</label>
            <input
              id="filter-from"
              type="date"
              value={draft.fromDate ?? ''}
              onChange={(event) => setDraft((current) => ({ ...current, fromDate: event.target.value || undefined }))}
            />
          </div>
          <div className="form-field">
            <label htmlFor="filter-to">To date</label>
            <input
              id="filter-to"
              type="date"
              value={draft.toDate ?? ''}
              onChange={(event) => setDraft((current) => ({ ...current, toDate: event.target.value || undefined }))}
            />
          </div>
          <div className="filter-actions">
            <button type="submit" className="btn btn-primary">Apply</button>
            <button type="button" className="btn" onClick={handleResetFilters}>Reset</button>
          </div>
        </form>

        {filterError && !state.error && (
          <div className="page-error" role="alert">
            {filterError}
          </div>
        )}

        <section className="data-panel">
          <div className="panel-header">
            <div>
              <h2>Transactions · <span className="account-num tabular-nums">{accountNumber}</span></h2>
              <span className="panel-subtitle">Verified ledger activity</span>
            </div>
            <span>{state.data ? `${state.data.totalElements} transaction${state.data.totalElements === 1 ? '' : 's'}` : ''}</span>
          </div>

          {state.loading && (
            <div className="panel-status-box" role="status">
              <div className="loading-spinner" aria-hidden="true" />
              <p>Loading transactions…</p>
            </div>
          )}

          {state.error && (
            <div className="panel-error" role="alert">
              <p>{state.error}</p>
              <button type="button" onClick={() => setReloadKey((key) => key + 1)}>Retry</button>
            </div>
          )}

          {!state.loading && !state.error && state.data && (
            state.data.content.length === 0 ? (
              <div className="empty-state-box">
                <div className="empty-state-icon" aria-hidden="true">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="5" width="20" height="14" rx="2" />
                    <line x1="2" y1="10" x2="22" y2="10" />
                  </svg>
                </div>
                <h3>{hasFilters ? 'No transactions match your filters' : 'No transactions recorded yet'}</h3>
                <p>
                  {hasFilters
                    ? 'Try adjusting your date range or resetting filters to view all activity.'
                    : 'Activity will appear here once incoming or outgoing transfers are executed.'}
                </p>
                {hasFilters && (
                  <button type="button" className="btn" onClick={handleResetFilters}>
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="table-scroll">
                  <table className="financial-table">
                    <thead>
                      <tr>
                        <th>Date & Time</th>
                        <th>Direction</th>
                        <th>From Account</th>
                        <th>To Account</th>
                        <th className="th-right">Amount</th>
                        <th>Status</th>
                        <th>Memo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.data.content.map((transaction) => {
                        const dir = direction(transaction, accountNumber)
                        const status = transactionStatusInfo(transaction.status)
                        return (
                          <tr key={transaction.id}>
                            <td className="tabular-nums font-medium text-slate-700">
                              {formatDateTime(transaction.transactionDate)}
                            </td>
                            <td>
                              <span className={`direction-pill ${dir.className}`}>
                                {dir.isOutflow ? '↓ Sent' : '↑ Received'}
                              </span>
                            </td>
                            <td>
                              <span className="account-cell tabular-nums">
                                {transaction.fromAccountNumber ?? '—'}
                                {transaction.fromAccountNumber && <CopyBtn text={transaction.fromAccountNumber} />}
                              </span>
                            </td>
                            <td>
                              <span className="account-cell tabular-nums">
                                {transaction.toAccountNumber ?? '—'}
                                {transaction.toAccountNumber && <CopyBtn text={transaction.toAccountNumber} />}
                              </span>
                            </td>
                            <td className="td-right">
                              <span className={`tx-amount tabular-nums ${dir.isOutflow ? 'tx-sent' : 'tx-received'}`}>
                                {dir.isOutflow ? '− ' : '+ '}
                                {formatMoney(transaction.amount)}
                              </span>
                            </td>
                            <td>
                              <span className={`badge ${status.badge}`}>{status.label}</span>
                              {transaction.errorReason && (
                                <div className="tx-error-reason">{transaction.errorReason}</div>
                              )}
                            </td>
                            <td className="memo-cell">{transaction.content ?? '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="pagination">
                  <span>
                    Page <strong>{state.data.pageNumber + 1}</strong> of <strong>{state.data.totalPages}</strong> ({state.data.totalElements} total)
                  </span>
                  <div>
                    <button
                      type="button"
                      className="btn"
                      disabled={state.data.pageNumber === 0}
                      onClick={() => setPage((current) => current - 1)}
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      className="btn"
                      disabled={state.data.last}
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