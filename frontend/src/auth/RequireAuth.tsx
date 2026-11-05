import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from './useAuth'

export function RequireAuth() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return (
      <div className="grid min-h-dvh place-items-center text-muted" role="status">
        Loading...
      </div>
    )
  }
  if (status === 'signedOut') {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  return <Outlet />
}
