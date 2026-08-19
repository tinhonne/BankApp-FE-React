import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { getAccounts } from '../api/accounts'
import { HttpError } from '../api/http'
import type { Account } from '../api/types'
import { formatMoney } from '../lib/accountStatus'

const ACCOUNT_PAGE_SIZE = 100

function errorMessage(error: unknown) {
  if (error instanceof HttpError) {
    return error.message
  }

  return 'Unable to load accounts.'
}

type AccountSearchSelectProps = {
  value: Account | null
  onChange: (account: Account | null) => void
  onUnauthorized: () => void
  disabled?: boolean
  excludeAccountNumber?: string
  refreshKey?: number
}

export default function AccountSearchSelect({
  value,
  onChange,
  onUnauthorized,
  disabled = false,
  excludeAccountNumber,
  refreshKey = 0,
}: AccountSearchSelectProps) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loadState, setLoadState] = useState({ error: '', loading: true })
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

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
    setLoadState({ error: '', loading: true })
    getAccounts(0, ACCOUNT_PAGE_SIZE, controller.signal)
      .then((data) => {
        setAccounts(data.content.filter((account) => account.status === 1))
        setLoadState({ error: '', loading: false })
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        if (!handleError(error)) {
          setLoadState({ error: errorMessage(error), loading: false })
        }
      })
    return () => controller.abort()
  }, [handleError, refreshKey])

  const q = query.trim().toLowerCase()
  const visible = accounts.filter((account) => {
    if (excludeAccountNumber && account.accountNumber === excludeAccountNumber) {
      return false
    }
    if (!q) {
      return true
    }
    return (
      (account.accountNumber ?? '').toLowerCase().includes(q) ||
      (account.customerName ?? '').toLowerCase().includes(q)
    )
  })

  let results: ReactNode = null
  if (loadState.error) {
    results = <li className="search-hint search-hint-error">{loadState.error}</li>
  } else if (loadState.loading) {
    results = <li className="search-hint">Loading accounts…</li>
  } else if (visible.length === 0) {
    results = <li className="search-hint">No matching active accounts found.</li>
  } else {
    results = visible.map((account) => (
      <li key={account.id}>
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            onChange(account)
            setOpen(false)
            setQuery('')
          }}
        >
          <span>
            <strong>{account.accountNumber ?? 'Unavailable'}</strong>
            <small>{account.customerName ?? 'no customer'}</small>
          </span>
          <span className="search-result-balance">{formatMoney(account.balance)}</span>
        </button>
      </li>
    ))
  }

  return (
    <div className="customer-search-select">
      {value ? (
        <div className="selected-customer">
          <div>
            <strong>{value.accountNumber ?? 'Unavailable'}</strong>
            <span>{value.customerName ?? 'no customer'} · {formatMoney(value.balance)}</span>
          </div>
          <button type="button" disabled={disabled} onClick={() => onChange(null)}>
            Clear
          </button>
        </div>
      ) : (
        <input
          type="text"
          placeholder="Search by account number or customer name"
          value={query}
          disabled={disabled}
          autoComplete="off"
          onFocus={() => setOpen(true)}
          onBlur={() => {
            setOpen(false)
            setQuery('')
          }}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
          }}
        />
      )}
      {open && !value && (
        <ul className="customer-search-results" role="listbox">
          {results}
        </ul>
      )}
    </div>
  )
}