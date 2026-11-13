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
  can: (role: Role) => boolean
}

const rank: Record<Role, number> = { viewer: 1, operator: 2, admin: 3 }
const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(() => getToken() !== null)

  const logout = useCallback(() => {
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

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      ssoError,
      logout,
      login: async (username, password) => {
        const res = await api.login(username, password)
        setToken(res.token)
        setUser(res.user)
      },
      can: (role) => user !== null && rank[user.role] >= rank[role],
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
