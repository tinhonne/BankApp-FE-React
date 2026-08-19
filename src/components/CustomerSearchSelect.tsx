import { useEffect, useRef, useState, type ReactNode } from 'react'
import { getCustomers } from '../api/customers'
import { HttpError } from '../api/http'
import type { Customer } from '../api/types'

const SEARCH_DEBOUNCE_MS = 300
const RESULT_PAGE_SIZE = 20

function errorMessage(error: unknown) {
  if (error instanceof HttpError) {
    return error.message
  }

  return 'Unable to search customers.'
}

type CustomerSearchSelectProps = {
  value: Customer | null
  onChange: (customer: Customer | null) => void
  onUnauthorized: () => void
  disabled?: boolean
}

export default function CustomerSearchSelect({
  value,
  onChange,
  onUnauthorized,
  disabled = false,
}: CustomerSearchSelectProps) {
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState<Customer[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const controllerRef = useRef<AbortController | null>(null)

  useEffect(() => () => controllerRef.current?.abort(), [])

  useEffect(() => {
    controllerRef.current?.abort()

    const q = query.trim()
    if (!open || !q) {
      setOptions([])
      setLoading(false)
      setError('')
      return
    }

    setLoading(true)
    setError('')

    const timer = window.setTimeout(() => {
      const controller = new AbortController()
      controllerRef.current = controller
      const isIdentityNumber = /^\d{10}$/.test(q)
      const filters = isIdentityNumber ? { identityNo: q, status: 1 } : { name: q, status: 1 }
      getCustomers(0, RESULT_PAGE_SIZE, filters, controller.signal)
        .then((data) => {
          setOptions(data.content)
          setLoading(false)
        })
        .catch((error) => {
          if (error instanceof DOMException && error.name === 'AbortError') return
          if (error instanceof HttpError && error.status === 401) {
            onUnauthorized()
            return
          }
          setOptions([])
          setError(errorMessage(error))
          setLoading(false)
        })
    }, SEARCH_DEBOUNCE_MS)

    return () => window.clearTimeout(timer)
  }, [onUnauthorized, open, query])

  let results: ReactNode = null
  if (error) {
    results = <li className="search-hint search-hint-error">{error}</li>
  } else if (loading) {
    results = <li className="search-hint">Searching…</li>
  } else if (options.length === 0) {
    results = <li className="search-hint">No matching customers found.</li>
  } else {
    results = options.map((customer) => (
      <li key={customer.id}>
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            onChange(customer)
            setOpen(false)
            setQuery('')
          }}
        >
          <strong>{customer.name ?? 'Unavailable'}</strong>
          <span>{customer.identityNo ?? 'no identity number'}</span>
        </button>
      </li>
    ))
  }

  return (
    <div className="customer-search-select">
      {value ? (
        <div className="selected-customer">
          <div>
            <strong>{value.name ?? 'Unavailable'}</strong>
            <span>{value.identityNo ?? 'no identity number'}</span>
          </div>
          <button type="button" disabled={disabled} onClick={() => onChange(null)}>
            Clear
          </button>
        </div>
      ) : (
        <input
          type="text"
          placeholder="Search by name or 10-digit identity number"
          value={query}
          disabled={disabled}
          autoComplete="off"
          onFocus={() => setOpen(true)}
          onBlur={() => {
            setOpen(false)
            setOptions([])
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