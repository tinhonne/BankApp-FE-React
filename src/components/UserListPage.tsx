import { useCallback, useEffect, useState } from 'react'
import { HttpError } from '../api/http'
import type { User } from '../api/types'
import { getUsers } from '../api/users'
import type { Session } from '../auth/session'
import { navigate } from '../lib/navigate'
import { roleBadge, roleLabel } from '../lib/userRole'
import PageHeader from './PageHeader'

type ListState = {
  data: User[] | null
  error: string
  loading: boolean
}

const initialListState: ListState = { data: null, error: '', loading: true }

function errorMessage(error: unknown) {
  if (error instanceof HttpError) {
    return error.message
  }

  return 'Unable to load this information.'
}

type UserListPageProps = {
  session: Session
  onUnauthorized: () => void
  onLogout: () => void
}

export default function UserListPage({ session, onUnauthorized, onLogout }: UserListPageProps) {
  const [state, setState] = useState<ListState>(initialListState)
  const [reloadKey, setReloadKey] = useState(0)

  const handleError = useCallback(
    (error: unknown) => {
      if (error instanceof HttpError && error.status === 401) {
        onUnauthorized()
        return true
      }
      if (error instanceof HttpError && error.status === 403) {
        setState({ data: null, error: 'You are not authorized to view users.', loading: false })
        return true
      }
      return false
    },
    [onUnauthorized],
  )

  useEffect(() => {
    const controller = new AbortController()
    setState((current) => ({ ...current, error: '', loading: true }))
    getUsers(controller.signal)
      .then((data) => setState({ data, error: '', loading: false }))
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        if (!handleError(error)) {
          setState((current) => ({ ...current, error: errorMessage(error), loading: false }))
        }
      })
    return () => controller.abort()
  }, [handleError, reloadKey])

  return (
    <main className="dashboard-page">
      <PageHeader session={session} onLogout={onLogout} />
      <div className="dashboard-content">
        <div className="page-titlebar">
          <div>
            <p className="eyebrow">User management</p>
            <h1>Users</h1>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/users/new')}>
            New user
          </button>
        </div>

        <section className="data-panel">
          <div className="panel-header">
            <h2>User list</h2>
            <span>{state.data ? `${state.data.length} user${state.data.length === 1 ? '' : 's'}` : ''}</span>
          </div>
          {state.loading && <p className="panel-status" role="status">Loading…</p>}
          {state.error && (
            <div className="panel-error" role="alert">
              <p>{state.error}</p>
              <button type="button" onClick={() => setReloadKey((key) => key + 1)}>Retry</button>
            </div>
          )}
          {!state.loading && !state.error && state.data && (
            state.data.length === 0 ? (
              <p className="panel-status">No users found.</p>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr><th>Username</th><th>Name</th><th>Roles</th><th>Status</th><th>Password</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {state.data.map((user) => (
                      <tr key={user.id}>
                        <td>{user.username ?? 'Unavailable'}</td>
                        <td>{user.name ?? 'Unavailable'}</td>
                        <td>
                          <div className="badge-group">
                            {user.roles.length > 0
                              ? user.roles.map((role) => (
                                  <span key={role} className={`badge ${roleBadge(role)}`}>{roleLabel(role)}</span>
                                ))
                              : '—'}
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${user.enabled ? 'badge-active' : 'badge-inactive'}`}>
                            {user.enabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${user.mustChangePassword ? 'badge-pending' : 'badge-active'}`}>
                            {user.mustChangePassword ? 'Must change' : 'OK'}
                          </span>
                        </td>
                        <td>
                          <div className="row-actions">
                            <button
                              type="button"
                              className="btn"
                              onClick={() => user.id !== null && navigate(`/users/${user.id}`)}
                            >
                              View
                            </button>
                            <button
                              type="button"
                              className="btn"
                              onClick={() => user.id !== null && navigate(`/users/${user.id}/edit`)}
                            >
                              Edit
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </section>
      </div>
    </main>
  )
}