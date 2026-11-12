import { useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { KeyRound, LogOut, Server } from 'lucide-react'
import { useEffect } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { openEventStream } from '../api-client/client'
import { useAuth } from '../auth/AuthProvider'

const REFRESH_THROTTLE_MS = 2000

/** Refetches agent queries when the backend reports agent changes, at most once per throttle window. */
function useLiveAgentUpdates() {
  const qc = useQueryClient()
  useEffect(() => {
    const es = openEventStream()
    let timer: ReturnType<typeof setTimeout> | undefined
    es.onmessage = () => {
      timer ??= setTimeout(() => {
        timer = undefined
        void qc.invalidateQueries({ queryKey: ['agents'] })
        void qc.invalidateQueries({ queryKey: ['summary'] })
      }, REFRESH_THROTTLE_MS)
    }
    return () => {
      clearTimeout(timer)
      es.close()
    }
  }, [qc])
}

export function Layout() {
  const { user, logout, can } = useAuth()
  useLiveAgentUpdates()

  const link = ({ isActive }: { isActive: boolean }) =>
    clsx('flex items-center gap-2 rounded-md px-2 py-1.5', isActive ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-hover hover:text-fg')

  return (
    <div className="flex h-full">
      <aside className="flex w-52 shrink-0 flex-col border-r border-border bg-panel p-3">
        <div className="px-2 pb-4 text-sm font-semibold">OpAMP Fleet</div>
        <nav className="flex-1 space-y-1">
          <NavLink to="/agents" className={link}>
            <Server size={15} /> Fleet
          </NavLink>
          {can('admin') && (
            <NavLink to="/credentials" className={link}>
              <KeyRound size={15} /> Agent credentials
            </NavLink>
          )}
        </nav>
        <div className="flex items-center justify-between border-t border-border px-2 pt-3 text-xs">
          <div>
            <div className="font-medium">{user?.subject}</div>
            <div className="text-muted capitalize">{user?.role}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={logout} title="Sign out">
            <LogOut size={14} />
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  )
}
