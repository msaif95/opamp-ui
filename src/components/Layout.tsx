import { useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import * as Tooltip from '@radix-ui/react-tooltip'
import { Activity, ChevronRight, FileCode, FolderKanban, KeyRound, Keyboard, LayoutDashboard, LogOut, Network, PanelLeftClose, PanelLeftOpen, Rocket, ScrollText, Search, Server, ShieldCheck, SlidersHorizontal, Tags, Users, type LucideIcon } from 'lucide-react'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { openEventStream } from '../api-client/client'
import { useAuth } from '../auth/AuthProvider'
import { LogoMark, ThemeSwitch, Wordmark } from './Brand'
import { Notifier } from './Notifier'
import { SearchPalette } from './SearchPalette'
import { ShortcutHelp } from './Shortcuts'
import { useShortcuts } from '../lib/shortcuts'

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
    // A page kept in the browser's back/forward cache would keep its stream open. Browsers allow only six
    // connections to a host, so a handful of reloads would leave none for the next page and it would hang.
    const close = () => es.close()
    window.addEventListener('pagehide', close)
    return () => {
      window.removeEventListener('pagehide', close)
      clearTimeout(timer)
      es.close()
    }
  }, [qc])
}

const COLLAPSED_KEY = 'opamp.sidebar.collapsed'


interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

const NAV: NavItem[] = [
  { to: '/overview', label: 'Overview', icon: LayoutDashboard },
  { to: '/agents', label: 'Fleet', icon: Server },
  { to: '/topology', label: 'Topology', icon: Network },
]

interface NavGroupDef {
  /** Also the key its open/closed state is remembered under. */
  id: string
  label: string
  icon: LucideIcon
  items: NavItem[]
  /** Whether it starts expanded for someone who has never toggled it. */
  defaultOpen: boolean
}

/** What collectors run and how it reaches them: used daily, so it starts open. */
const CONFIGURATION: NavGroupDef = {
  id: 'configuration',
  label: 'Configuration',
  icon: SlidersHorizontal,
  defaultOpen: true,
  items: [
    { to: '/configs', label: 'Config', icon: FileCode },
    { to: '/groups', label: 'Group', icon: Tags },
    { to: '/rollouts', label: 'Bulk push', icon: Rocket },
  ],
}

/** Administrator pages, grouped under one "Admin" entry. */
const ADMIN: NavGroupDef = { id: 'admin', label: 'Admin', icon: ShieldCheck, defaultOpen: false, items: [] }
ADMIN.items = [
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/users', label: 'Users', icon: Users },
  { to: '/credentials', label: 'Agent credentials', icon: KeyRound },
  { to: '/audit', label: 'Audit & compliance', icon: ScrollText },
  { to: '/system', label: 'System', icon: Activity },
]

const itemClass = (active: boolean, collapsed: boolean) =>
  clsx(
    'relative flex h-8 w-full items-center gap-2 rounded-md',
    collapsed ? 'justify-center px-0' : 'px-2.5',
    active
      ? 'bg-accent-soft font-medium text-accent before:absolute before:inset-y-1.5 before:-left-3 before:w-[3px] before:rounded-r before:bg-accent'
      : 'text-muted hover:bg-hover hover:text-fg',
  )

/** Whether a nav target is the current page or a page beneath it. */
const useActive = () => {
  const { pathname } = useLocation()
  return (to: string) => pathname === to || pathname.startsWith(to + '/')
}

/**
 * A group of pages under one sidebar entry. In the full sidebar it expands and collapses in place on click, and opens by itself while one
 * of its pages is showing so the current page stays visible. In the icon-only sidebar there is no room to expand,
 * so it is a single icon that opens a menu on click.
 */
function NavGroup({ group, collapsed }: { group: NavGroupDef; collapsed: boolean }) {
  const storageKey = `opamp.sidebar.${group.id}-open`
  const active = useActive()
  const onGroupPage = group.items.some((n) => active(n.to))
  const [open, setOpen] = useState(() => (localStorage.getItem(storageKey) ?? (group.defaultOpen ? '1' : '0')) === '1')
  // Arriving on one of the group's pages shows the group, without changing what the user chose for other pages.
  // It can still be closed while there; that lasts until the user leaves the group's pages.
  const [closedHere, setClosedHere] = useState(false)
  if (!onGroupPage && closedHere) setClosedHere(false)
  const expanded = onGroupPage ? !closedHere : open
  const toggle = () => {
    if (onGroupPage) {
      setClosedHere(!closedHere)
      return
    }
    localStorage.setItem(storageKey, open ? '0' : '1')
    setOpen(!open)
  }

  if (collapsed) {
    return (
      <DropdownMenu.Root>
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <DropdownMenu.Trigger className={itemClass(onGroupPage, true)} aria-label={group.label}>
              <group.icon size={15} className="shrink-0" />
            </DropdownMenu.Trigger>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content side="right" sideOffset={8} className="z-50 rounded bg-fg px-2 py-1 text-xs text-bg shadow">
              {group.label}
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
        <DropdownMenu.Portal>
          <DropdownMenu.Content side="right" align="start" sideOffset={8} className="z-50 min-w-48 rounded-md border border-border bg-panel p-1 shadow-lg">
            <DropdownMenu.Label className="px-2 pb-1 pt-1 text-[11px] font-medium uppercase tracking-wide text-muted">{group.label}</DropdownMenu.Label>
            {group.items.map(({ to, label, icon: Icon }) => (
              <DropdownMenu.Item key={to} asChild>
                <Link
                  to={to}
                  aria-current={active(to) ? 'page' : undefined}
                  className={clsx(
                    'flex cursor-default select-none items-center gap-2 rounded px-2 py-1.5 text-[13px] outline-none data-[highlighted]:bg-accent-soft data-[highlighted]:text-accent',
                    active(to) ? 'font-medium text-accent' : 'text-fg',
                  )}
                >
                  <Icon size={14} className="shrink-0" /> {label}
                </Link>
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    )
  }

  return (
    <div>
      <button
        className={clsx(itemClass(false, false), onGroupPage && !expanded && 'text-accent')}
        onClick={toggle}
        aria-expanded={expanded}
        aria-controls={`${group.id}-nav`}
      >
        <group.icon size={15} className="shrink-0" />
        <span className="flex-1 truncate text-left">{group.label}</span>
        <ChevronRight size={14} className={clsx('shrink-0 transition-transform duration-150', expanded && 'rotate-90')} />
      </button>
      {expanded && (
        <div id={`${group.id}-nav`} className="ml-[17px] mt-1 space-y-1 border-l border-border pl-2">
          {group.items.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} className={itemClass(active(to), false)} aria-current={active(to) ? 'page' : undefined}>
              <Icon size={14} className="shrink-0" />
              <span className="truncate">{label}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

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

  const active = useActive()
  const [searching, setSearching] = useState(false)
  const [showingHelp, setShowingHelp] = useState(false)
  const openSearch = useCallback(() => setSearching(true), [])
  const openHelp = useCallback(() => setShowingHelp(true), [])
  useShortcuts(openSearch, openHelp)

  return (
    <Tooltip.Provider delayDuration={200}>
      {/* Keyboard users can jump past the navigation. */}
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[70] focus:rounded focus:bg-panel focus:px-3 focus:py-2 focus:shadow-lg">
        Skip to content
      </a>
      <Notifier />
      <SearchPalette open={searching} onClose={() => setSearching(false)} />
      <ShortcutHelp open={showingHelp} onClose={() => setShowingHelp(false)} />
      <div className="flex h-full">
        <aside
          className={clsx('flex shrink-0 flex-col border-r border-border bg-sidebar p-3 transition-[width] duration-150', collapsed ? 'w-14' : 'w-56')}
          aria-label="Main navigation"
        >
          <div className={clsx('flex items-center pt-1', collapsed ? 'flex-col gap-3 pb-3' : 'gap-2.5 pb-5 pl-1.5')}>
            <LogoMark />
            {!collapsed && <Wordmark />}
            <Tip label="Expand sidebar" show={collapsed}>
              <button
                className={clsx('flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-fg', !collapsed && 'ml-auto')}
                onClick={toggle}
                aria-expanded={!collapsed}
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                title={collapsed ? undefined : 'Collapse sidebar'}
              >
                {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
              </button>
            </Tip>
          </div>
          <Tip label="Search (/)" show={collapsed}>
            <button
              className={clsx(
                'mb-3 flex h-8 items-center gap-2 rounded-md border border-border bg-panel text-muted hover:border-border-strong hover:text-fg',
                collapsed ? 'justify-center' : 'px-2.5',
              )}
              onClick={openSearch}
              aria-label="Search"
              aria-keyshortcuts="/"
            >
              <Search size={14} className="shrink-0" />
              {!collapsed && (
                <>
                  <span className="flex-1 text-left">Search</span>
                  <kbd className="rounded border border-border px-1 font-mono text-[11px]">/</kbd>
                </>
              )}
            </button>
          </Tip>
          <nav className="flex-1 space-y-1 overflow-y-auto">
            {NAV.map(({ to, label, icon: Icon }) => (
              <Tip key={to} label={label} show={collapsed}>
                <Link to={to} className={itemClass(active(to), collapsed)} aria-label={label} aria-current={active(to) ? 'page' : undefined}>
                  <Icon size={15} className="shrink-0" />
                  {!collapsed && <span className="truncate">{label}</span>}
                </Link>
              </Tip>
            ))}
            <NavGroup group={CONFIGURATION} collapsed={collapsed} />
            {can('admin') && <NavGroup group={ADMIN} collapsed={collapsed} />}
          </nav>
          <Tip label="Keyboard shortcuts (?)" show={collapsed}>
            <button
              className={clsx('mb-2 flex h-8 items-center gap-2 rounded-md text-xs text-muted hover:bg-hover hover:text-fg', collapsed ? 'justify-center' : 'px-2.5')}
              onClick={openHelp}
              aria-label="Keyboard shortcuts"
              aria-keyshortcuts="?"
            >
              <Keyboard size={15} className="shrink-0" />
              {!collapsed && 'Keyboard shortcuts'}
            </button>
          </Tip>
          <div className="pb-3">
            <ThemeSwitch compact={collapsed} />
          </div>
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
        <main id="main" tabIndex={-1} className="min-w-0 flex-1 overflow-auto p-6 outline-none">
          <Outlet />
        </main>
      </div>
    </Tooltip.Provider>
  )
}
