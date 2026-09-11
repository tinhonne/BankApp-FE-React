import { type ReactNode } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { getAccounts } from '../api/accounts'
import { getCustomers } from '../api/customers'
import { HttpError } from '../api/http'
import type { Account, Customer, PageResponse, User } from '../api/types'
import { getUsers } from '../api/users'
import type { Session } from '../auth/session'
import { accountStatusBadge, accountStatusLabel, formatMoney } from '../lib/accountStatus'
import { navigate } from '../lib/navigate'
import PageHeader from './PageHeader'

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

  const canViewCustomers = session.roles.includes('EMPLOYEE') || session.roles.includes('MANAGER')
  const canViewAccounts = session.roles.includes('EMPLOYEE') || session.roles.includes('MANAGER')
  const canViewUsers = session.roles.includes('ADMIN') || session.roles.includes('MANAGER')
  const canTransfer = session.roles.includes('EMPLOYEE') || session.roles.includes('MANAGER')

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
        const data = await getCustomers(0, 5, {}, signal)
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
        const data = await getAccounts(0, 5, signal)
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
    if (canViewCustomers) {
      void loadCustomers(controller.signal)
    }
    if (canViewAccounts) {
      void loadAccounts(controller.signal)
    }
    if (canViewUsers) {
      void loadUsers(controller.signal)
    }
    return () => controller.abort()
  }, [canViewAccounts, canViewCustomers, canViewUsers, loadAccounts, loadCustomers, loadUsers])

  return (
    <main className="dashboard-page">
      <PageHeader session={session} onLogout={onLogout} />

      <div className="dashboard-content">
        <div className="dashboard-intro">
          <div>
            <p className="eyebrow">Operations Overview</p>
            <h1>Portal Dashboard</h1>
          </div>
          <div className="dashboard-intro-actions">
            <p>Verified customer and account information from core banking services.</p>
            <div className="quick-actions-bar">
              {canTransfer && (
                <button type="button" className="btn btn-primary" onClick={() => navigate('/transfer')}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="7" y1="17" x2="17" y2="7" />
                    <polyline points="7 7 17 7 17 17" />
                  </svg>
                  Transfer funds
                </button>
              )}
              {canViewAccounts && (
                <button type="button" className="btn" onClick={() => navigate('/accounts/new')}>
                  Open account
                </button>
              )}
              {canViewCustomers && (
                <button type="button" className="btn" onClick={() => navigate('/customers/new')}>
                  Add customer
                </button>
              )}
            </div>
          </div>
        </div>

        <section className="summary-grid" aria-label="Verified totals">
          {canViewCustomers && (
            <article className="summary-card" onClick={() => navigate('/customers')} tabIndex={0} role="button">
              <div className="summary-card-top">
                <span>Total customers</span>
                <div className="summary-icon icon-blue" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
              </div>
              <strong className="tabular-nums">{customers.data?.totalElements ?? '—'}</strong>
            </article>
          )}

          {canViewAccounts && (
            <article className="summary-card" onClick={() => navigate('/accounts')} tabIndex={0} role="button">
              <div className="summary-card-top">
                <span>Total accounts</span>
                <div className="summary-icon icon-navy" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="5" width="20" height="14" rx="2" />
                    <line x1="2" y1="10" x2="22" y2="10" />
                  </svg>
                </div>
              </div>
              <strong className="tabular-nums">{accounts.data?.totalElements ?? '—'}</strong>
            </article>
          )}

          {canViewUsers && (
            <article className="summary-card" onClick={() => navigate('/users')} tabIndex={0} role="button">
              <div className="summary-card-top">
                <span>Total portal users</span>
                <div className="summary-icon icon-purple" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
              </div>
              <strong className="tabular-nums">{users.data?.length ?? '—'}</strong>
            </article>
          )}
        </section>

        <div className="dashboard-grid">
          {canViewCustomers && (
            <DataPanel
              title="Recent Customers"
              loading={customers.loading}
              error={customers.error}
              onRetry={() => void loadCustomers()}
              headerRight={
                <button type="button" className="link-btn" onClick={() => navigate('/customers')}>
                  View all →
                </button>
              }
            >
              {customers.data && (
                customers.data.content.length === 0 ? (
                  <EmptyState />
                ) : (
                  <CustomerTable customers={customers.data.content} />
                )
              )}
            </DataPanel>
          )}

          {canViewAccounts && (
            <DataPanel
              title="Recent Accounts"
              loading={accounts.loading}
              error={accounts.error}
              onRetry={() => void loadAccounts()}
              headerRight={
                <button type="button" className="link-btn" onClick={() => navigate('/accounts')}>
                  View all →
                </button>
              }
            >
              {accounts.data && (
                accounts.data.content.length === 0 ? (
                  <EmptyState />
                ) : (
                  <AccountTable accounts={accounts.data.content} />
                )
              )}
            </DataPanel>
          )}

          {canViewUsers && (
            <DataPanel
              title="Portal Users"
              loading={users.loading}
              error={users.error}
              onRetry={() => void loadUsers()}
              wide
              headerRight={
                <button type="button" className="link-btn" onClick={() => navigate('/users')}>
                  View all →
                </button>
              }
            >
              {users.data && (
                users.data.length === 0 ? (
                  <EmptyState />
                ) : (
                  <UserTable users={users.data} />
                )
              )}
            </DataPanel>
          )}
        </div>
      </div>
    </main>
  )
}

function DataPanel({
  title,
  loading,
  error,
  onRetry,
  wide = false,
  headerRight,
  children,
}: {
  title: string
  loading: boolean
  error: string
  onRetry: () => void
  wide?: boolean
  headerRight?: ReactNode
  children: ReactNode
}) {
  return (
    <section className={`data-panel${wide ? ' data-panel-wide' : ''}`}>
      <div className="panel-header">
        <h2>{title}</h2>
        <span>{headerRight ?? 'First 5 records'}</span>
      </div>
      {loading && (
        <div className="panel-status-box" role="status">
          <div className="loading-spinner" aria-hidden="true" />
          <p>Loading records…</p>
        </div>
      )}
      {error && (
        <div className="panel-error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={onRetry}>Retry</button>
        </div>
      )}
      {!loading && !error && children}
    </section>
  )
}

function EmptyState() {
  return <p className="panel-status">No records found.</p>
}

function CustomerTable({ customers }: { customers: Customer[] }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((customer, index) => {
            const isActive = customer.status === 1
            return (
              <tr
                key={customer.id ?? index}
                className="clickable-row"
                onClick={() => customer.id && navigate(`/customers/${customer.id}`)}
              >
                <td><strong>{customer.name ?? 'Unavailable'}</strong></td>
                <td>{customer.customerType ?? 'Unavailable'}</td>
                <td>
                  <span className={`badge ${isActive ? 'badge-active' : 'badge-inactive'}`}>
                    {isActive ? 'Active' : customer.status === 0 ? 'Inactive' : 'Unavailable'}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function AccountTable({ accounts }: { accounts: Account[] }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Account No</th>
            <th>Customer</th>
            <th className="th-right">Balance</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((account, index) => (
            <tr
              key={account.id ?? index}
              className="clickable-row"
              onClick={() => account.id && navigate(`/accounts/${account.id}`)}
            >
              <td><span className="account-num tabular-nums">{account.accountNumber ?? 'Unavailable'}</span></td>
              <td>{account.customerName ?? 'Unavailable'}</td>
              <td className="td-right tabular-nums font-semibold">{formatMoney(account.balance)}</td>
              <td>
                <span className={`badge ${accountStatusBadge(account.status)}`}>
                  {accountStatusLabel(account.status)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function UserTable({ users }: { users: User[] }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Username</th>
            <th>Roles</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user, index) => (
            <tr
              key={user.id ?? index}
              className="clickable-row"
              onClick={() => user.id && navigate(`/users/${user.id}`)}
            >
              <td><strong>{user.name ?? 'Unavailable'}</strong></td>
              <td className="tabular-nums">{user.username ?? 'Unavailable'}</td>
              <td>
                <div className="badge-group">
                  {user.roles.map((role) => (
                    <span key={role} className={`badge badge-role-${role.toLowerCase()}`}>
                      {role}
                    </span>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
