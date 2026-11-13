import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ArrowDown, ArrowUp, Download, GitCompareArrows, Plus, RefreshCw, Search, Server, X } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api, type AgentQuery } from '../../api-client/client'
import { useAuth } from '../../auth/AuthProvider'
import { EmptyState } from '../../components/EmptyState'
import { ProjectName, useHasProjects } from '../../components/ProjectSelect'
import { AgentStatus, ConfigStatus, ErrorNote, PageHeader } from '../../components/ui'
import { timeAgo } from '../../lib/time'
import { Select } from '../../components/Select'

const PAGE_SIZE = 50
/** Safety-net refresh for "last seen"; real changes arrive through the event stream. */
const BACKGROUND_REFRESH_MS = 30_000

/** One view per summary card; each maps to a server-side filter. */
const views = {
  all: { label: 'All', filter: {} },
  connected: { label: 'Connected', filter: { connected: true } },
  offline: { label: 'Offline', filter: { connected: false } },
  healthy: { label: 'Healthy', filter: { connected: true, healthy: true } },
  unhealthy: { label: 'Unhealthy', filter: { connected: true, healthy: false } },
  config_failed: { label: 'Config failed', filter: { configStatus: 'failed' } },
} satisfies Record<string, { label: string; filter: Partial<AgentQuery> }>
type View = keyof typeof views

function StatCard({ label, value, tone, active, onClick }: { label: string; value: number | undefined; tone?: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={clsx('card px-4 py-3 text-left transition-colors hover:border-accent', active && 'border-accent ring-2 ring-accent/20')}
    >
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className={clsx('mt-0.5 text-2xl font-semibold tracking-tight', tone)}>{value?.toLocaleString() ?? '–'}</div>
    </button>
  )
}

export function FleetDashboard() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { can } = useAuth()
  // Other pages link here with filters already applied: ?view=unhealthy, ?attr=region=eu, ?q=…, ?group=…, ?project=….
  const [params] = useSearchParams()
  const [page, setPage] = useState(0)
  const [view, setView] = useState<View>(() => (params.get('view') && params.get('view')! in views ? (params.get('view') as View) : 'all'))
  const [sort, setSort] = useState<AgentQuery['sort']>('name')
  const [order, setOrder] = useState<AgentQuery['order']>('asc')
  const [attrs, setAttrs] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      params
        .getAll('attr')
        .map((kv) => [kv.slice(0, kv.indexOf('=')), kv.slice(kv.indexOf('=') + 1)])
        .filter(([k]) => k),
    ),
  )
  const [groupId, setGroupId] = useState(() => params.get('group') ?? '')
  const [project, setProject] = useState(() => params.get('project') ?? '')
  // Free-text search: what is typed, and what is sent once typing pauses.
  const [searchText, setSearchText] = useState(() => params.get('q') ?? '')
  const [search, setSearch] = useState(searchText)
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchText.trim())
      setPage(0)
    }, 250)
    return () => clearTimeout(timer)
  }, [searchText])
  // Up to two collectors ticked for comparison.
  const [picked, setPicked] = useState<string[]>([])
  const exporting = useMutation({ mutationFn: (format: 'csv' | 'json') => api.exportAgents(query, format) })
  const { user } = useAuth()
  const hasProjects = useHasProjects()
  const groups = useQuery({ queryKey: ['groups'], queryFn: api.groups })
  const [filterText, setFilterText] = useState('')
  const [filterError, setFilterError] = useState(false)

  /** The project filter value for a group's project. */
  const projectOf = (id: string) => groups.data?.groups.find((g) => g.id === id)?.project_id ?? 'none'
  const summary = useQuery({ queryKey: ['summary', project, groupId], queryFn: () => api.summary(project || undefined, groupId || undefined), refetchInterval: BACKGROUND_REFRESH_MS })
  const query: AgentQuery = { limit: PAGE_SIZE, offset: page * PAGE_SIZE, sort, order, attrs, groupId: groupId || undefined, project: project || undefined, search: search || undefined, ...views[view].filter }
  const agents = useQuery({
    queryKey: ['agents', query],
    queryFn: () => api.agents(query),
    placeholderData: keepPreviousData,
    refetchInterval: BACKGROUND_REFRESH_MS,
  })

  const show = (v: View) => {
    setView(v)
    setPage(0)
  }
  const sortBy = (column: AgentQuery['sort']) => {
    if (column === sort) {
      setOrder(order === 'asc' ? 'desc' : 'asc')
    } else {
      setSort(column)
      setOrder(column === 'name' ? 'asc' : 'desc')
    }
    setPage(0)
  }
  const addFilter = (e: FormEvent) => {
    e.preventDefault()
    const i = filterText.indexOf('=')
    if (i <= 0) return setFilterError(true)
    setAttrs({ ...attrs, [filterText.slice(0, i).trim()]: filterText.slice(i + 1).trim() })
    setFilterText('')
    setFilterError(false)
    setPage(0)
  }
  const removeFilter = (key: string) => {
    setAttrs(Object.fromEntries(Object.entries(attrs).filter(([k]) => k !== key)))
    setPage(0)
  }
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ['agents'] }), qc.invalidateQueries({ queryKey: ['summary'] })])

  const total = agents.data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const s = summary.data

  const sortHeader = (column: AgentQuery['sort'], label: string) => (
    <th aria-sort={sort === column ? (order === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="inline-flex items-center gap-1 hover:text-fg" onClick={() => sortBy(column)}>
        {label}
        {sort === column && (order === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
      </button>
    </th>
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title="Fleet"
        action={
          <>
            {picked.length === 2 && (
              <Link to={`/agents/compare?a=${picked[0]}&b=${picked[1]}`} className="btn">
                <GitCompareArrows size={14} /> Compare selected
              </Link>
            )}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger className="btn" disabled={exporting.isPending}>
                <Download size={14} /> {exporting.isPending ? 'Exporting…' : 'Export'}
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content align="end" sideOffset={4} className="z-50 min-w-56 rounded-md border border-border bg-panel p-1 shadow-lg">
                  <DropdownMenu.Label className="px-2 py-1 text-xs text-muted">
                    The {total.toLocaleString()} collectors matching the filters, with every attribute
                  </DropdownMenu.Label>
                  {(['csv', 'json'] as const).map((format) => (
                    <DropdownMenu.Item
                      key={format}
                      className="cursor-default select-none rounded px-2 py-1.5 outline-none data-[highlighted]:bg-accent-soft data-[highlighted]:text-accent"
                      onSelect={() => exporting.mutate(format)}
                    >
                      Download as {format.toUpperCase()}
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
            <button className="btn" onClick={refresh} disabled={agents.isFetching}>
              <RefreshCw size={13} className={agents.isFetching ? 'animate-spin' : ''} /> Refresh
            </button>
            {can('admin') && (
              <Link to="/agents/install" className="btn btn-primary">
                <Plus size={14} /> Add collectors
              </Link>
            )}
          </>
        }
      />

      {exporting.error && <ErrorNote error={exporting.error} />}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Total agents" value={s?.total} active={view === 'all'} onClick={() => show('all')} />
        <StatCard label="Connected" value={s?.connected} active={view === 'connected'} onClick={() => show('connected')} />
        <StatCard label="Healthy" value={s?.healthy} tone="text-success" active={view === 'healthy'} onClick={() => show('healthy')} />
        <StatCard
          label="Unhealthy"
          value={s?.unhealthy}
          tone={s?.unhealthy ? 'text-danger' : undefined}
          active={view === 'unhealthy'}
          onClick={() => show('unhealthy')}
        />
        <StatCard
          label="Config failed"
          value={s?.config_failed}
          tone={s?.config_failed ? 'text-danger' : undefined}
          active={view === 'config_failed'}
          onClick={() => show('config_failed')}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="seg">
          {(['all', 'connected', 'offline'] as const).map((v) => (
            <button key={v} className={view === v ? 'active' : ''} onClick={() => show(v)}>
              {views[v].label}
            </button>
          ))}
        </div>
        {view !== 'all' && view !== 'connected' && view !== 'offline' && (
          <span className="chip border-accent text-accent">
            {views[view].label}
            <button onClick={() => show('all')} aria-label="Clear status filter">
              <X size={12} />
            </button>
          </span>
        )}
        {hasProjects && (
          <Select
            className="w-44"
            value={project}
            aria-label="Project"
            onChange={(v) => {
              setProject(v)
              // A group belongs to one project, so it cannot stay selected under a different one.
              if (groupId && v !== '' && projectOf(groupId) !== v) setGroupId('')
              setPage(0)
            }}
            options={[
              { value: '', label: 'All projects' },
              ...(user?.projects ?? []).map((p) => ({ value: p.id, label: p.name })),
              ...(user?.admin || user?.role ? [{ value: 'none', label: 'No project' }] : []),
            ]}
          />
        )}
        {(groups.data?.groups.length ?? 0) > 0 && (
          <Select
            className="w-48"
            value={groupId}
            aria-label="Group"
            onChange={(v) => {
              setGroupId(v)
              // Picking a group shows its project, so the two filters and the cards always agree.
              if (v && hasProjects) setProject(projectOf(v))
              setPage(0)
            }}
            options={[
              { value: '', label: 'All groups' },
              // With a project chosen, only that project's groups are offered.
              ...(groups.data?.groups ?? [])
                .filter((g) => project === '' || (g.project_id ?? 'none') === project)
                .map((g) => ({ value: g.id, label: g.name, hint: `${g.members.toLocaleString()} agents` })),
            ]}
          />
        )}
        <div className="relative">
          <Search size={13} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <input
            className="input w-64 pl-7"
            type="search"
            placeholder="Search host, IP, UID or attribute"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            aria-label="Search collectors"
          />
        </div>
        <form onSubmit={addFilter}>
          <input
            className={`input w-56 ${filterError ? 'border-danger' : ''}`}
            placeholder="Filter: key=value (e.g. env=prod)"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
          />
        </form>
        {Object.entries(attrs).map(([k, v]) => (
          <span key={k} className="chip">
            {k}={v}
            <button onClick={() => removeFilter(k)} aria-label={`Remove filter ${k}`}>
              <X size={12} />
            </button>
          </span>
        ))}
      </div>

      {s?.total === 0 && !search && Object.keys(attrs).length === 0 && !groupId && !project ? (
        <EmptyState
          icon={Server}
          title="No collectors yet"
          action={
            can('admin') ? (
              <Link to="/agents/install" className="btn btn-primary">
                <Plus size={14} /> Add collectors
              </Link>
            ) : undefined
          }
        >
          <p>
            Collectors appear here as soon as they connect. The console generates an install script that downloads the OpenTelemetry
            Collector and its OpAMP Supervisor and points them at this backend.
          </p>
          {!can('admin') && <p>Ask an administrator to add collectors to one of your projects.</p>}
        </EmptyState>
      ) : (
      <div className="card overflow-auto">
        {agents.error ? (
          <ErrorNote error={agents.error} />
        ) : (
          <table className="table dense">
            <thead>
              <tr>
                <th className="w-8">
                  <span className="sr-only">Select to compare</span>
                </th>
                <th>Status</th>
                {sortHeader('name', 'Host')}
                {hasProjects && <th>Project</th>}
                <th>Service</th>
                <th>Version</th>
                <th>Env</th>
                <th>Region</th>
                <th>Connector</th>
                <th>Auth</th>
                <th>Remote config</th>
                {sortHeader('last_seen', 'Last seen')}
              </tr>
            </thead>
            <tbody>
              {agents.data?.agents.map((a) => (
                <tr key={a.instance_uid} className="cursor-pointer" onClick={() => navigate(`/agents/${a.instance_uid}`)}>
                  <td onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="accent-[var(--c-accent)]"
                      checked={picked.includes(a.instance_uid)}
                      // A third tick replaces the older of the two.
                      onChange={(e) => setPicked(e.target.checked ? [...picked, a.instance_uid].slice(-2) : picked.filter((id) => id !== a.instance_uid))}
                      aria-label={`Select ${a.attributes['host.name'] ?? a.instance_uid} to compare`}
                    />
                  </td>
                  <td>
                    <AgentStatus agent={a} />
                  </td>
                  <td className="font-mono text-xs">{a.attributes['host.name'] ?? a.instance_uid}</td>
                  {hasProjects && (
                    <td>
                      <ProjectName id={a.project_id} />
                    </td>
                  )}
                  <td>{a.attributes['service.name'] ?? '–'}</td>
                  <td>{a.agent_version ?? '–'}</td>
                  <td>{a.attributes['env'] ?? '–'}</td>
                  <td>{a.attributes['region'] ?? '–'}</td>
                  <td>{a.connector_type === 'k8s_bridge' ? 'Kubernetes bridge' : a.connector_type}</td>
                  <td>{a.auth_mode === 'mtls' ? 'mTLS' : 'API key'}</td>
                  <td>
                    <ConfigStatus status={a.remote_config_status} />
                  </td>
                  <td className="text-muted">{timeAgo(a.last_seen)}</td>
                </tr>
              ))}
              {agents.data?.agents.length === 0 && (
                <tr>
                  <td colSpan={12} className="py-8 text-center text-muted">
                    No collectors match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
      )}

      <div className="flex items-center justify-between text-xs text-muted">
        <span>{total.toLocaleString()} agents</span>
        <div className="flex items-center gap-2">
          <button className="btn btn-sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
            Previous
          </button>
          <span>
            Page {page + 1} of {pages}
          </span>
          <button className="btn btn-sm" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>
            Next
          </button>
        </div>
      </div>
    </div>
  )
}
