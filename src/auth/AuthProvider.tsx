import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, getToken, setToken, setUnauthorizedHandler, type Role, type User } from '../api-client/client'

/**
 * After single sign-on the backend redirects to `/#token=…` (or `/#login_error=…`). Runs once at module load,
 * before the provider reads the stored token, and removes the fragment so the token never lingers in the URL.
 */
function consumeLoginFragment(): string | null {
  const params = new URLSearchParams(window.location.hash.slice(1))
  const token = params.get('token')
  const error = params.get('login_error')
  if (!token && !error) return null
  if (token) setToken(token)
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
  return error
}
const ssoError = consumeLoginFragment()

interface AuthState {
  user: User | null
  loading: boolean
  /** Why the last single sign-on attempt failed, if it did. */
  ssoError: string | null
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  /** Re-reads the user's projects and roles, e.g. after an admin creates a project. */
  reloadUser: () => Promise<void>
  /** True if the user has at least this role somewhere: globally or in any project. Use it to decide whether to offer an action at all. */
  can: (role: Role) => boolean
  /** True if the user has at least this role on a resource in the given project (null: outside any project). */
  canIn: (project: string | null, role: Role) => boolean
  /** Projects (and "no project", as null) in which the user has at least this role, for "create in…" pickers. */
  projectsFor: (role: Role) => { id: string | null; name: string }[]
}

const rank: Record<Role | '', number> = { '': 0, viewer: 1, operator: 2, admin: 3 }
const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(() => getToken() !== null)

  const logout = useCallback(() => {
    // End the session on the server too, so the token cannot be reused. Best effort: sign out locally regardless.
    if (getToken()) void api.logout().catch(() => undefined)
    setToken(null)
    setUser(null)
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(logout)
    if (!getToken()) return
    api
      .me()
      .then(setUser)
      .catch(logout)
      .finally(() => setLoading(false))
  }, [logout])

  // Sign out after a period without keyboard or pointer input. The console refreshes data in the background,
  // which keeps the server-side session alive, so idleness has to be judged here; the server still ends sessions
  // whose tab was closed.
  const idleSeconds = user?.session_idle_seconds ?? 0
  useEffect(() => {
    if (idleSeconds <= 0) return
    let last = Date.now()
    const active = () => {
      last = Date.now()
    }
    const events = ['pointerdown', 'keydown', 'wheel'] as const
    events.forEach((e) => window.addEventListener(e, active, { passive: true }))
    const timer = setInterval(() => {
      if (Date.now() - last > idleSeconds * 1000) logout()
    }, 15_000)
    return () => {
      events.forEach((e) => window.removeEventListener(e, active))
      clearInterval(timer)
    }
  }, [idleSeconds, logout])

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      ssoError,
      logout,
      reloadUser: async () => setUser(await api.me()),
      login: async (username, password) => {
        const res = await api.login(username, password)
        setToken(res.token)
        setUser(await api.me())
      },
      can: (role) =>
        user !== null && (user.admin || rank[user.role] >= rank[role] || user.projects.some((p) => rank[p.role] >= rank[role])),
      canIn: (project, role) => {
        if (!user) return false
        if (user.admin) return true
        if (project === null) return rank[user.role] >= rank[role]
        return rank[user.projects.find((p) => p.id === project)?.role ?? ''] >= rank[role]
      },
      projectsFor: (role) => {
        if (!user) return []
        const list: { id: string | null; name: string }[] = user.projects.filter((p) => user.admin || rank[p.role] >= rank[role])
        if (user.admin || rank[user.role] >= rank[role]) list.push({ id: null, name: 'No project' })
        return list
      },
    }),
    [user, loading, logout],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// oxlint-disable-next-line react/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
