import { useState, type FormEvent } from 'react'
import { LogoMark, ThemeSwitch, Wordmark } from '../components/Brand'
import { useAuth } from './AuthProvider'

export function LoginPage() {
  const { login } = useAuth()
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
      <form onSubmit={submit} className="card relative w-80 space-y-4 p-6">
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
            autoFocus
          />
        </label>
        {error && <p className="text-xs text-danger">{error}</p>}
        <button className="btn btn-primary w-full justify-center" disabled={busy || !password}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <div className="relative w-32">
        <ThemeSwitch />
      </div>
    </div>
  )
}
