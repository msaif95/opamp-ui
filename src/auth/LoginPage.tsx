import { useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { api } from '../api-client/client'
import { LogoMark, ThemeSwitch, Wordmark } from '../components/Brand'
import { useAuth } from './AuthProvider'

export function LoginPage() {
  const { login, ssoError } = useAuth()
  const methods = useQuery({ queryKey: ['auth-config'], queryFn: api.authConfig, staleTime: Infinity })
  const okta = methods.data?.okta ?? false
  // Until the backend answers, assume the local form so a break-glass login is never hidden by an outage.
  const local = methods.data?.local ?? true
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(username, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-6 overflow-hidden">
      <div className="brand-gradient pointer-events-none absolute -top-40 h-80 w-[40rem] rounded-full opacity-20 blur-3xl" aria-hidden="true" />
      <div className="relative flex flex-col items-center gap-3">
        <LogoMark size={44} />
        <Wordmark large />
        <p className="text-xs text-muted">Fleet management for OpenTelemetry Collectors</p>
      </div>
      <div className="card relative w-80 space-y-4 p-6">
        {ssoError && <p className="rounded-md bg-danger/10 p-2 text-xs text-danger">{ssoError}</p>}
        {okta && (
          <a href="/api/v1/auth/okta/login" className="btn btn-primary w-full justify-center">
            Sign in with Okta
          </a>
        )}
        {okta && local && (
          <div className="flex items-center gap-3 text-xs text-faint">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>
        )}
        {!okta && !local && <p className="text-xs text-danger">No sign-in method is configured on the server.</p>}
        {local && (
      <form onSubmit={submit} className="space-y-4">
        <p className="text-xs text-muted">Local administrator sign-in</p>
        <label className="block space-y-1">
          <span className="text-xs text-muted">Username</span>
          <input className="input w-full" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-muted">Password</span>
          <input
            className="input w-full"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            autoFocus={!okta}
          />
        </label>
        {error && <p className="text-xs text-danger">{error}</p>}
        <button className={`btn w-full justify-center ${okta ? '' : 'btn-primary'}`} disabled={busy || !password}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
        )}
      </div>
      <div className="relative w-32">
        <ThemeSwitch />
      </div>
    </div>
  )
}
