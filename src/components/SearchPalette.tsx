import * as Dialog from '@radix-ui/react-dialog'
import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { FileCode, LayoutDashboard, Search, Server, Tags, type LucideIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api-client/client'
import { useAuth } from '../auth/AuthProvider'
import { AgentStatus } from './ui'

interface Result {
  key: string
  to: string
  icon: LucideIcon
  title: string
  detail?: string
  section: string
  status?: React.ReactNode
}

const PAGES: { to: string; title: string; admin?: boolean }[] = [
  { to: '/overview', title: 'Overview' },
  { to: '/agents', title: 'Fleet' },
  { to: '/topology', title: 'Topology' },
  { to: '/configs', title: 'Configs' },
  { to: '/groups', title: 'Groups' },
  { to: '/rollouts', title: 'Bulk push' },
  { to: '/projects', title: 'Projects', admin: true },
  { to: '/users', title: 'Users', admin: true },
  { to: '/credentials', title: 'Agent credentials', admin: true },
  { to: '/audit', title: 'Audit log', admin: true },
  { to: '/system', title: 'System', admin: true },
]

/**
 * Search across everything the user can see: collectors by host name, IP address, instance UID or any attribute,
 * plus configs, groups and pages. Arrow keys move, Enter opens.
 */
export function SearchPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px]" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-[12vh] z-50 w-[min(40rem,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-lg border border-border bg-panel shadow-xl focus:outline-none"
        >
          {/* Mounted only while open, so each opening starts from an empty search. */}
          <Palette onClose={onClose} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function Palette({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const { user, can } = useAuth()
  const [text, setText] = useState('')
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  // Collectors are searched on the server, so wait for a pause in typing.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(text.trim()), 200)
    return () => clearTimeout(timer)
  }, [text])
  const agents = useQuery({
    queryKey: ['agents', 'search', query],
    queryFn: () => api.agents({ limit: 8, offset: 0, sort: 'name', order: 'asc', attrs: {}, search: query }),
    enabled: query.length > 0,
    placeholderData: (previous) => previous,
  })
  const configs = useQuery({ queryKey: ['configs'], queryFn: api.configs })
  const groups = useQuery({ queryKey: ['groups'], queryFn: api.groups })

  const results = useMemo<Result[]>(() => {
    const q = text.trim().toLowerCase()
    const has = (s: string | null | undefined) => (s ?? '').toLowerCase().includes(q)
    const project = (id: string | null) => user?.projects.find((p) => p.id === id)?.name
    const pages = PAGES.filter((p) => (!p.admin || can('admin')) && has(p.title)).map(
      (p): Result => ({ key: p.to, to: p.to, icon: LayoutDashboard, title: p.title, section: 'Pages' }),
    )
    if (q === '') return pages
    return [
      ...(query === '' ? [] : (agents.data?.agents ?? [])).map(
        (a): Result => ({
          key: a.instance_uid,
          to: `/agents/${a.instance_uid}`,
          icon: Server,
          title: a.attributes['host.name'] ?? a.instance_uid,
          detail: [project(a.project_id), a.attributes['host.ip'], a.attributes['env'], a.attributes['region'], a.instance_uid].filter(Boolean).join(' · '),
          section: 'Collectors',
          status: <AgentStatus agent={a} />,
        }),
      ),
      ...(configs.data?.configs ?? [])
        .filter((c) => has(c.name) || has(c.description))
        .slice(0, 5)
        .map((c): Result => ({ key: c.id, to: `/configs/${c.id}`, icon: FileCode, title: c.name, detail: [project(c.project_id), c.description].filter(Boolean).join(' · '), section: 'Configs' })),
      ...(groups.data?.groups ?? [])
        .filter((g) => has(g.name) || has(g.description))
        .slice(0, 5)
        .map((g): Result => ({ key: g.id, to: `/agents?group=${g.id}`, icon: Tags, title: g.name, detail: `${g.members.toLocaleString()} collectors`, section: 'Groups' })),
      ...pages,
    ]
  }, [text, query, agents.data, configs.data, groups.data, user, can])

  const current = Math.min(active, Math.max(0, results.length - 1))
  const go = (r: Result | undefined) => {
    if (!r) return
    onClose()
    navigate(r.to)
  }
  const more = (agents.data?.total ?? 0) - (agents.data?.agents.length ?? 0)

  return (
    <>
          <Dialog.Title className="sr-only">Search</Dialog.Title>
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search size={15} className="shrink-0 text-muted" aria-hidden />
            <input
              className="h-11 w-full bg-transparent outline-none placeholder:text-faint"
              placeholder="Search collectors by host, IP, UID or attribute; configs; groups; pages"
              value={text}
              onChange={(e) => {
                setText(e.target.value)
                setActive(0)
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                  e.preventDefault()
                  setActive(Math.min(results.length - 1, Math.max(0, current + (e.key === 'ArrowDown' ? 1 : -1))))
                } else if (e.key === 'Enter') {
                  e.preventDefault()
                  go(results[current])
                }
              }}
              role="combobox"
              aria-expanded
              aria-controls="search-results"
              aria-activedescendant={results[current] ? `search-result-${current}` : undefined}
              aria-label="Search"
              autoFocus
            />
          </div>
          <ul id="search-results" role="listbox" aria-label="Results" className="max-h-[60vh] overflow-y-auto p-1">
            {results.map((r, i) => (
              <li key={r.section + r.key} role="presentation">
                {(i === 0 || results[i - 1].section !== r.section) && (
                  <div className="px-2 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-muted">{r.section}</div>
                )}
                <div
                  id={`search-result-${i}`}
                  role="option"
                  aria-selected={i === current}
                  className={clsx('flex cursor-pointer items-center gap-2.5 rounded px-2 py-1.5', i === current && 'bg-accent-soft')}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(r)}
                >
                  <r.icon size={14} className="shrink-0 text-muted" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className={clsx('truncate', r.section === 'Collectors' && 'font-mono text-xs')}>{r.title}</div>
                    {r.detail && <div className="truncate text-xs text-muted">{r.detail}</div>}
                  </div>
                  {r.status}
                </div>
              </li>
            ))}
            {results.length === 0 && <li className="px-3 py-6 text-center text-muted">{agents.isFetching ? 'Searching…' : 'Nothing matches.'}</li>}
          </ul>
          <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-muted">
            <span>↑ ↓ to move · Enter to open · Esc to close</span>
            {query !== '' && more > 0 && (
              <button
                className="font-medium text-accent hover:underline"
                onClick={() => {
                  onClose()
                  navigate(`/agents?q=${encodeURIComponent(query)}`)
                }}
              >
                Show all {agents.data?.total.toLocaleString()} matching collectors
              </button>
            )}
          </div>
    </>
  )
}
