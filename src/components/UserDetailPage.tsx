import { useCallback, useEffect, useState } from 'react'
import { HttpError } from '../api/http'
import type { UserDetail } from '../api/types'
import { getUser } from '../api/users'
import type { Session } from '../auth/session'
import { navigate } from '../lib/navigate'
import { roleBadge, roleLabel } from '../lib/userRole'
import PageHeader from './PageHeader'

type State = {
  data: UserDetail | null
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

type UserDetailPageProps = {
  id: number
  session: Session
  onUnauthorized: () => void
  onLogout: () => void
}

export default function UserDetailPage({ id, session, onUnauthorized, onLogout }: UserDetailPageProps) {
  const [state, setState] = useState<State>(initialState)

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
    getUser(id, controller.signal)
      .then((data) => setState({ data, error: '', loading: false }))
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        if (!handleError(error)) {
          const message = error instanceof HttpError && error.code === 'USER_NOT_FOUND'
            ? 'User not found.'
            : errorMessage(error)
          setState({ data: null, error: message, loading: false })
        }
      })
    return () => controller.abort()
  }, [handleError, id])

  const user = state.data

  return (
    <main className="dashboard-page">
      <PageHeader session={session} onLogout={onLogout} />
      <div className="dashboard-content">
        <div className="page-titlebar">
          <div>
            <p className="eyebrow">User management</p>
            <h1>User details</h1>
          </div>
          <div className="row-actions">
            <button type="button" className="btn" onClick={() => navigate('/users')}>Back to list</button>
            {user && (
              <button
                type="button"
                className="btn"
                onClick={() => user.id !== null && navigate(`/users/${user.id}/edit`)}
              >
                Edit
              </button>
            )}
          </div>
        </div>

        {state.loading && <p className="panel-status" role="status">Loading…</p>}

        {state.error && (
          <section className="data-panel">
            <div className="panel-error" role="alert">
              <p>{state.error}</p>
            </div>
          </section>
        )}

        {!state.loading && !state.error && user && (
          <section className="detail-card">
            <div className="panel-header">
              <h2>{user.name ?? 'Unavailable'}</h2>
              <span className={`badge ${user.enabled ? 'badge-active' : 'badge-inactive'}`}>
                {user.enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <div className="detail-grid">
              <div className="detail-item">
                <span>Username</span>
                <strong>{user.username ?? '—'}</strong>
              </div>
              <div className="detail-item">
                <span>Name</span>
                <strong>{user.name ?? '—'}</strong>
              </div>
              <div className="detail-item">
                <span>Roles</span>
                <strong>
                  <div className="badge-group">
                    {user.roles.length > 0
                      ? user.roles.map((role) => (
                          <span key={role} className={`badge ${roleBadge(role)}`}>{roleLabel(role)}</span>
                        ))
                      : '—'}
                  </div>
                </strong>
              </div>
              <div className="detail-item">
                <span>Password status</span>
                <strong>{user.mustChangePassword ? 'Must change password' : 'OK'}</strong>
              </div>
              <div className="detail-item detail-item-full">
                <span>Permissions ({user.permissions.length})</span>
                <div className="permission-list">
                  {user.permissions.length > 0
                    ? user.permissions.map((permission) => (
                        <span key={permission} className="permission-chip">{permission}</span>
                      ))
                    : '—'}
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  )
}