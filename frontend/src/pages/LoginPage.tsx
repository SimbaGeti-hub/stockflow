import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { ApiError } from '../lib/api'
import { AuthLayout } from '../ui/AuthLayout'
import { PasswordField } from '../ui/PasswordField'
import { inputClass, labelClass, primaryButtonClass } from '../ui/classes'

export default function LoginPage() {
  const { status, login } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/'

  if (status === 'signedIn') return <Navigate to={from} replace />

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(email, password)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not sign in. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout title="Sign in" subtitle="Welcome back. Enter your details to continue.">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="email" className={labelClass}>
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </div>
        <PasswordField
          id="password"
          label="Password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
        />
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy} className={primaryButtonClass + ' w-full'}>
          {busy ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
      <p className="mt-5 text-center text-sm text-muted">
        New here?{' '}
        <Link to="/register" className="font-medium text-primary underline-offset-2 hover:underline">
          Create a business account
        </Link>
      </p>
    </AuthLayout>
  )
}
