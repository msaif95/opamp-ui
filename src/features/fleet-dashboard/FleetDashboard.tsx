import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { ArrowDown, ArrowUp, RefreshCw, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type AgentQuery } from '../../api-client/client'
import { AgentStatus, ConfigStatus, ErrorNote } from '../../components/ui'
import { timeAgo } from '../../lib/time'

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
  const [page, setPage] = useState(0)
  const [view, setView] = useState<View>('all')
  const [sort, setSort] = useState<AgentQuery['sort']>('name')
  const [order, setOrder] = useState<AgentQuery['order']>('asc')
  const [attrs, setAttrs] = useState<Record<string, string>>({})
  const [filterText, setFilterText] = useState('')
  const [filterError, setFilterError] = useState(false)

  const summary = useQuery({ queryKey: ['summary'], queryFn: api.summary, refetchInterval: BACKGROUND_REFRESH_MS })
  const query: AgentQuery = { limit: PAGE_SIZE, offset: page * PAGE_SIZE, sort, order, attrs, ...views[view].filter }
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
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Fleet</h1>
        <button className="btn" onClick={refresh} disabled={agents.isFetching}>
          <RefreshCw size={13} className={agents.isFetching ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

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

      <div className="card overflow-auto">
        {agents.error ? (
          <ErrorNote error={agents.error} />
        ) : (
          <table className="table dense">
            <thead>
              <tr>
                <th>Status</th>
                {sortHeader('name', 'Host')}
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
                  <td>
                    <AgentStatus agent={a} />
                  </td>
                  <td className="font-mono text-xs">{a.attributes['host.name'] ?? a.instance_uid}</td>
                  <td>{a.attributes['service.name'] ?? '–'}</td>
                  <td>{a.agent_version ?? '–'}</td>
                  <td>{a.attributes['env'] ?? '–'}</td>
                  <td>{a.attributes['region'] ?? '–'}</td>
                  <td>{a.connector_type}</td>
                  <td>{a.auth_mode === 'mtls' ? 'mTLS' : 'API key'}</td>
                  <td>
                    <ConfigStatus status={a.remote_config_status} />
                  </td>
                  <td className="text-muted">{timeAgo(a.last_seen)}</td>
                </tr>
              ))}
              {agents.data?.agents.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-muted">
                    No agents match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

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
