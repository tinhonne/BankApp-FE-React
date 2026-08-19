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
    return { label: 'Sent', className: 'tx-sent' }
  }
  if (transaction.toAccountNumber === accountNumber) {
    return { label: 'Received', className: 'tx-received' }
  }
  return { label: '—', className: '' }
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

  return (
    <main className="dashboard-page">
      <PageHeader session={session} onLogout={onLogout} />
      <div className="dashboard-content">
        <div className="page-titlebar">
          <div>
            <p className="eyebrow">Transactions</p>
            <h1>Transaction history</h1>
          </div>
          <div className="row-actions">
            <button type="button" className="btn" onClick={() => navigate(`/accounts/${accountNumber}`)}>View account</button>
            <button type="button" className="btn" onClick={() => navigate('/accounts')}>Back to accounts</button>
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
            <h2>Transactions · {accountNumber}</h2>
            <span>{state.data ? `${state.data.totalElements} result${state.data.totalElements === 1 ? '' : 's'}` : ''}</span>
          </div>
          {state.loading && <p className="panel-status" role="status">Loading…</p>}
          {state.error && (
            <div className="panel-error" role="alert">
              <p>{state.error}</p>
              <button type="button" onClick={() => setReloadKey((key) => key + 1)}>Retry</button>
            </div>
          )}
          {!state.loading && !state.error && state.data && (
            state.data.content.length === 0 ? (
              <p className="panel-status">No transactions found.</p>
            ) : (
              <>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr><th>Date</th><th>Type</th><th>From</th><th>To</th><th>Amount</th><th>Status</th><th>Content</th></tr>
                    </thead>
                    <tbody>
                      {state.data.content.map((transaction) => {
                        const dir = direction(transaction, accountNumber)
                        const status = transactionStatusInfo(transaction.status)
                        return (
                          <tr key={transaction.id}>
                            <td>{formatDateTime(transaction.transactionDate)}</td>
                            <td className={dir.className}>{dir.label}</td>
                            <td>{transaction.fromAccountNumber ?? '—'}</td>
                            <td>{transaction.toAccountNumber ?? '—'}</td>
                            <td>{formatMoney(transaction.amount)}</td>
                            <td>
                              <span className={`badge ${status.badge}`}>{status.label}</span>
                              {transaction.errorReason && (
                                <div className="tx-error-reason">{transaction.errorReason}</div>
                              )}
                            </td>
                            <td>{transaction.content ?? '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="pagination">
                  <span>
                    Page {state.data.pageNumber + 1} of {state.data.totalPages}
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