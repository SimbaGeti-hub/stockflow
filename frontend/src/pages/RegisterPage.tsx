import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { ApiError } from '../lib/api'
import { AuthLayout } from '../ui/AuthLayout'
import { PasswordField } from '../ui/PasswordField'
import { inputClass, labelClass, primaryButtonClass } from '../ui/classes'

export default function RegisterPage() {
  const { status, register } = useAuth()
  const [fullName, setFullName] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [currencyCode, setCurrencyCode] = useState('UGX')
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  if (status === 'signedIn') return <Navigate to="/" replace />

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setFieldErrors({})
    try {
      await register({ fullName, email, password, businessName, currencyCode })
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message)
        setFieldErrors(e.fieldErrors)
      } else {
        setError('Could not create the account. Check your connection and try again.')
      }
    } finally {
      setBusy(false)
    }
  }

  function field(
    id: string,
    label: string,
    value: string,
    set: (v: string) => void,
    type = 'text',
    autoComplete?: string,
  ) {
    return (
      <div>
        <label htmlFor={id} className={labelClass}>
          {label}
        </label>
        <input
          id={id}
          type={type}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => set(e.target.value)}
          aria-invalid={fieldErrors[id] ? true : undefined}
          aria-describedby={fieldErrors[id] ? `${id}-error` : undefined}
          className={inputClass}
        />
        {fieldErrors[id] && (
          <p id={`${id}-error`} className="mt-1 text-sm text-danger">
            {fieldErrors[id]}
          </p>
        )}
      </div>
    )
  }

  return (
    <AuthLayout title="Create your business" subtitle="Set up your workspace. You will be its owner.">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {field('fullName', 'Your name', fullName, setFullName, 'text', 'name')}
        {field('businessName', 'Business name', businessName, setBusinessName, 'text', 'organization')}
        {field('email', 'Email', email, setEmail, 'email', 'email')}
        <PasswordField
          id="password"
          label="Password (at least 8 characters)"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          error={fieldErrors['password']}
        />
        {field('currencyCode', 'Currency code', currencyCode, setCurrencyCode)}
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy} className={primaryButtonClass + ' w-full'}>
          {busy ? 'Creating...' : 'Create account'}
        </button>
      </form>
      <p className="mt-5 text-center text-sm text-muted">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-primary underline-offset-2 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  )
}
