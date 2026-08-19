import type { Session } from '../auth/session'

type PageHeaderProps = {
  session: Session
  onLogout: () => void
}

export default function PageHeader({ session, onLogout }: PageHeaderProps) {
  return (
    <header className="dashboard-header">
      <div className="dashboard-brand"><span aria-hidden="true">B</span> Bank App</div>
      <div className="session-controls">
        <div><strong>{session.username}</strong><span>{session.roles.join(', ')}</span></div>
        <button type="button" onClick={onLogout}>Sign out</button>
      </div>
    </header>
  )
}
