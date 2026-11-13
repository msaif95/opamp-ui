import { useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { FileCode, KeyRound, LogOut, Rocket, ScrollText, Server, Tags } from 'lucide-react'
import { useEffect } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { openEventStream } from '../api-client/client'
import { useAuth } from '../auth/AuthProvider'
import { LogoMark, ThemeSwitch, Wordmark } from './Brand'

const REFRESH_THROTTLE_MS = 5000

/**
 * Refetches agent queries when the backend reports a real agent change (connect, disconnect, health, config),
 * at most once per throttle window. Heartbeats are not reported, so an idle fleet causes no refetches.
 */
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
    clsx(
      'relative flex items-center gap-2 rounded-md px-2.5 py-1.5',
      isActive
        ? 'bg-accent-soft font-medium text-accent before:absolute before:inset-y-1.5 before:-left-3 before:w-[3px] before:rounded-r before:bg-accent'
        : 'text-muted hover:bg-hover hover:text-fg',
    )

  return (
    <div className="flex h-full">
      <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-sidebar p-3">
        <div className="flex items-center gap-2.5 px-1.5 pb-5 pt-1">
          <LogoMark />
          <Wordmark />
        </div>
        <nav className="flex-1 space-y-1">
          <NavLink to="/agents" className={link}>
            <Server size={15} /> Fleet
          </NavLink>
          <NavLink to="/configs" className={link}>
            <FileCode size={15} /> Configs
          </NavLink>
          <NavLink to="/groups" className={link}>
            <Tags size={15} /> Groups
          </NavLink>
          <NavLink to="/rollouts" className={link}>
            <Rocket size={15} /> Bulk push
          </NavLink>
          {can('admin') && (
            <NavLink to="/credentials" className={link}>
              <KeyRound size={15} /> Agent credentials
            </NavLink>
          )}
          {can('admin') && (
            <NavLink to="/audit" className={link}>
              <ScrollText size={15} /> Audit log
            </NavLink>
          )}
        </nav>
        <div className="pb-3">
          <ThemeSwitch />
        </div>
        <div className="flex items-center justify-between border-t border-border px-1.5 pt-3 text-xs">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold uppercase text-accent">
              {user?.subject.charAt(0)}
            </span>
            <div className="min-w-0">
              <div className="truncate font-medium">{user?.subject}</div>
              <div className="text-muted capitalize">{user?.role}</div>
            </div>
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
