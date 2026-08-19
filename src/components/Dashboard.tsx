import { useCallback, useEffect, useState } from 'react'
import { getAccounts } from '../api/accounts'
import { getCustomers } from '../api/customers'
import { HttpError } from '../api/http'
import type { Account, Customer, PageResponse, User } from '../api/types'
import { getUsers } from '../api/users'
import type { Session } from '../auth/session'

type PanelState<T> = {
  data: T | null
  error: string
  loading: boolean
}

const initialPanelState = { data: null, error: '', loading: true }

function errorMessage(error: unknown) {
  if (error instanceof HttpError) {
    return error.message
  }

  return 'Unable to load this information.'
}

type DashboardProps = {
  session: Session
  onUnauthorized: () => void
  onLogout: () => void
}

export default function Dashboard({ session, onUnauthorized, onLogout }: DashboardProps) {
  const [customers, setCustomers] = useState<PanelState<PageResponse<Customer>>>(initialPanelState)
  const [accounts, setAccounts] = useState<PanelState<PageResponse<Account>>>(initialPanelState)
  const [users, setUsers] = useState<PanelState<User[]>>(initialPanelState)

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

  const loadCustomers = useCallback(
    async (signal?: AbortSignal) => {
      setCustomers((current) => ({ ...current, error: '', loading: true }))
      try {
        const data = await getCustomers(signal)
        setCustomers({ data, error: '', loading: false })
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
        if (!handleError(error)) {
          setCustomers((current) => ({ ...current, error: errorMessage(error), loading: false }))
        }
      }
    },
    [handleError],
  )

  const loadAccounts = useCallback(
    async (signal?: AbortSignal) => {
      setAccounts((current) => ({ ...current, error: '', loading: true }))
      try {
        const data = await getAccounts(signal)
        setAccounts({ data, error: '', loading: false })
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
        if (!handleError(error)) {
          setAccounts((current) => ({ ...current, error: errorMessage(error), loading: false }))
        }
      }
    },
    [handleError],
  )

  const loadUsers = useCallback(
    async (signal?: AbortSignal) => {
      setUsers((current) => ({ ...current, error: '', loading: true }))
      try {
        const data = await getUsers(signal)
        setUsers({ data, error: '', loading: false })
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
        if (!handleError(error)) {
          const message = error instanceof HttpError && error.status === 403
            ? 'You are not authorized to view users.'
            : errorMessage(error)
          setUsers((current) => ({ ...current, error: message, loading: false }))
        }
      }
    },
    [handleError],
  )

  useEffect(() => {
    const controller = new AbortController()
    void loadCustomers(controller.signal)
    void loadAccounts(controller.signal)
    if (session.roles.includes('ADMIN') || session.roles.includes('MANAGER')) {
      void loadUsers(controller.signal)
    }
    return () => controller.abort()
  }, [loadAccounts, loadCustomers, loadUsers, session.roles])

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <div className="dashboard-brand"><span aria-hidden="true">B</span> Bank App</div>
        <div className="session-controls">
          <div><strong>{session.username}</strong><span>{session.roles.join(', ')}</span></div>
          <button type="button" onClick={onLogout}>Sign out</button>
        </div>
      </header>

      <div className="dashboard-content">
        <div className="dashboard-intro">
          <div><p className="eyebrow">Operations overview</p><h1>Dashboard</h1></div>
          <p>Verified customer and account information from the banking service.</p>
        </div>

        <section className="summary-grid" aria-label="Verified totals">
          <article className="summary-card"><span>Total customers</span><strong>{customers.data?.totalElements ?? '—'}</strong></article>
          <article className="summary-card"><span>Total accounts</span><strong>{accounts.data?.totalElements ?? '—'}</strong></article>
          {(session.roles.includes('ADMIN') || session.roles.includes('MANAGER')) && <article className="summary-card"><span>Total users</span><strong>{users.data?.length ?? '—'}</strong></article>}
        </section>

        <div className="dashboard-grid">
          <DataPanel title="Customers" loading={customers.loading} error={customers.error} onRetry={() => void loadCustomers()}>
            {customers.data && (customers.data.content.length === 0 ? <EmptyState /> : <CustomerTable customers={customers.data.content} />)}
          </DataPanel>
          <DataPanel title="Accounts" loading={accounts.loading} error={accounts.error} onRetry={() => void loadAccounts()}>
            {accounts.data && (accounts.data.content.length === 0 ? <EmptyState /> : <AccountTable accounts={accounts.data.content} />)}
          </DataPanel>
          {(session.roles.includes('ADMIN') || session.roles.includes('MANAGER')) && (
            <DataPanel title="Users" loading={users.loading} error={users.error} onRetry={() => void loadUsers()} wide>
              {users.data && (users.data.length === 0 ? <EmptyState /> : <UserTable users={users.data} />)}
            </DataPanel>
          )}
        </div>
      </div>
    </main>
  )
}

function DataPanel({ title, loading, error, onRetry, wide = false, children }: { title: string; loading: boolean; error: string; onRetry: () => void; wide?: boolean; children: React.ReactNode }) {
  return <section className={`data-panel${wide ? ' data-panel-wide' : ''}`}><div className="panel-header"><h2>{title}</h2><span>First 5 records</span></div>{loading && <p className="panel-status" role="status">Loading…</p>}{error && <div className="panel-error" role="alert"><p>{error}</p><button type="button" onClick={onRetry}>Retry</button></div>}{!loading && !error && children}</section>
}

function EmptyState() {
  return <p className="panel-status">No records found.</p>
}

function CustomerTable({ customers }: { customers: Customer[] }) {
  return <div className="table-scroll"><table><thead><tr><th>Name</th><th>Type</th><th>Status</th></tr></thead><tbody>{customers.map((customer, index) => <tr key={customer.id ?? index}><td>{customer.name ?? 'Unavailable'}</td><td>{customer.customerType ?? 'Unavailable'}</td><td>{customer.status ?? 'Unavailable'}</td></tr>)}</tbody></table></div>
}

function AccountTable({ accounts }: { accounts: Account[] }) {
  return <div className="table-scroll"><table><thead><tr><th>Account</th><th>Customer</th><th>Balance</th><th>Status</th></tr></thead><tbody>{accounts.map((account, index) => <tr key={account.id ?? index}><td>{account.accountNumber ?? 'Unavailable'}</td><td>{account.customerName ?? 'Unavailable'}</td><td>{account.balance === null ? 'Unavailable' : account.balance.toLocaleString()}</td><td>{account.status === 1 ? 'Active' : (account.status ?? 'Unavailable')}</td></tr>)}</tbody></table></div>
}

function UserTable({ users }: { users: User[] }) {
  return <div className="table-scroll"><table><thead><tr><th>Name</th><th>Username</th><th>Roles</th></tr></thead><tbody>{users.map((user, index) => <tr key={user.id ?? index}><td>{user.name ?? 'Unavailable'}</td><td>{user.username ?? 'Unavailable'}</td><td>{user.roles.length > 0 ? user.roles.join(', ') : 'Unavailable'}</td></tr>)}</tbody></table></div>
}
