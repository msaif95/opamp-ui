import { useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import * as Tooltip from '@radix-ui/react-tooltip'
import { Activity, FileCode, FolderKanban, KeyRound, LogOut, PanelLeftClose, PanelLeftOpen, Rocket, ScrollText, Server, Tags, Users, type LucideIcon } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
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

const COLLAPSED_KEY = 'opamp.sidebar.collapsed'

const NAV: { to: string; label: string; icon: LucideIcon; admin?: boolean }[] = [
  { to: '/agents', label: 'Fleet', icon: Server },
  { to: '/configs', label: 'Configs', icon: FileCode },
  { to: '/groups', label: 'Groups', icon: Tags },
  { to: '/rollouts', label: 'Bulk push', icon: Rocket },
  { to: '/projects', label: 'Projects', icon: FolderKanban, admin: true },
  { to: '/users', label: 'Users', icon: Users, admin: true },
  { to: '/credentials', label: 'Agent credentials', icon: KeyRound, admin: true },
  { to: '/audit', label: 'Audit log', icon: ScrollText, admin: true },
  { to: '/system', label: 'System', icon: Activity, admin: true },
]

/** Shows a label beside an icon-only control; only used while the sidebar is collapsed. */
function Tip({ label, show, children }: { label: string; show: boolean; children: ReactNode }) {
  if (!show) return children
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content side="right" sideOffset={8} className="z-50 rounded bg-fg px-2 py-1 text-xs text-bg shadow">
          {label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}

export function Layout() {
  const { user, logout, can } = useAuth()
  useLiveAgentUpdates()
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSED_KEY) === '1')
  const toggle = () => {
    localStorage.setItem(COLLAPSED_KEY, collapsed ? '0' : '1')
    setCollapsed(!collapsed)
  }
  const roleText = user?.admin ? 'Admin' : user?.role || `${user?.projects.length ?? 0} project${user?.projects.length === 1 ? '' : 's'}`

  const link = ({ isActive }: { isActive: boolean }) =>
    clsx(
      'relative flex h-8 items-center gap-2 rounded-md',
      collapsed ? 'justify-center px-0' : 'px-2.5',
      isActive
        ? 'bg-accent-soft font-medium text-accent before:absolute before:inset-y-1.5 before:-left-3 before:w-[3px] before:rounded-r before:bg-accent'
        : 'text-muted hover:bg-hover hover:text-fg',
    )

  return (
    <Tooltip.Provider delayDuration={200}>
      <div className="flex h-full">
        <aside
          className={clsx('flex shrink-0 flex-col border-r border-border bg-sidebar p-3 transition-[width] duration-150', collapsed ? 'w-14' : 'w-56')}
          aria-label="Main navigation"
        >
          <div className={clsx('flex items-center pb-5 pt-1', collapsed ? 'justify-center' : 'gap-2.5 px-1.5')}>
            <LogoMark />
            {!collapsed && <Wordmark />}
          </div>
          <nav className="flex-1 space-y-1">
            {NAV.filter((n) => !n.admin || can('admin')).map(({ to, label, icon: Icon }) => (
              <Tip key={to} label={label} show={collapsed}>
                <NavLink to={to} className={link} aria-label={label}>
                  <Icon size={15} className="shrink-0" />
                  {!collapsed && <span className="truncate">{label}</span>}
                </NavLink>
              </Tip>
            ))}
          </nav>
          {!collapsed && (
            <div className="pb-3">
              <ThemeSwitch />
            </div>
          )}
          <Tip label="Expand sidebar" show={collapsed}>
            <button
              className={clsx('mb-3 flex h-8 items-center gap-2 rounded-md text-xs text-muted hover:bg-hover hover:text-fg', collapsed ? 'justify-center' : 'px-2.5')}
              onClick={toggle}
              aria-expanded={!collapsed}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
              {!collapsed && 'Collapse'}
            </button>
          </Tip>
          <div className={clsx('flex items-center border-t border-border pt-3 text-xs', collapsed ? 'flex-col gap-2' : 'justify-between px-1.5')}>
            <Tip label={`${user?.subject} (${roleText})`} show={collapsed}>
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold uppercase text-accent">
                  {user?.subject.charAt(0)}
                </span>
                {!collapsed && (
                  <div className="min-w-0">
                    <div className="truncate font-medium">{user?.subject}</div>
                    <div className="text-muted capitalize">{roleText}</div>
                  </div>
                )}
              </div>
            </Tip>
            <Tip label="Sign out" show={collapsed}>
              <button className="btn btn-ghost btn-sm" onClick={logout} aria-label="Sign out" title={collapsed ? undefined : 'Sign out'}>
                <LogOut size={14} />
              </button>
            </Tip>
          </div>
        </aside>
        <main className="min-w-0 flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </Tooltip.Provider>
  )
}
