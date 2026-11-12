import { useState, type FormEvent } from 'react'
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
    <div className="flex h-full items-center justify-center">
      <form onSubmit={submit} className="card w-80 space-y-4 p-6">
        <div>
          <h1 className="text-base font-semibold">OpAMP Fleet Manager</h1>
          <p className="text-xs text-muted">Local administrator sign-in</p>
        </div>
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
    </div>
  )
}
