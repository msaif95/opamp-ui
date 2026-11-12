import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api-client/client'
import { AgentStatus, ConfigStatus, ErrorNote } from '../../components/ui'
import { timeAgo } from '../../lib/time'

const PAGE_SIZE = 50

function Stat({ label, value, tone }: { label: string; value: number | undefined; tone?: string }) {
  return (
    <div className="card px-4 py-3">
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className={`mt-0.5 text-2xl font-semibold tracking-tight ${tone ?? ''}`}>{value?.toLocaleString() ?? '–'}</div>
    </div>
  )
}

export function FleetDashboard() {
  const navigate = useNavigate()
  const [page, setPage] = useState(0)
  const [connected, setConnected] = useState<boolean | undefined>(undefined)
  const [attrs, setAttrs] = useState<Record<string, string>>({})
  const [filterText, setFilterText] = useState('')
  const [filterError, setFilterError] = useState(false)

  const summary = useQuery({ queryKey: ['summary'], queryFn: api.summary })
  const query = { limit: PAGE_SIZE, offset: page * PAGE_SIZE, connected, attrs }
  const agents = useQuery({ queryKey: ['agents', query], queryFn: () => api.agents(query), placeholderData: keepPreviousData })

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

  const total = agents.data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const s = summary.data

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Fleet</h1>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Total agents" value={s?.total} />
        <Stat label="Connected" value={s?.connected} />
        <Stat label="Healthy" value={s?.healthy} tone="text-success" />
        <Stat label="Unhealthy" value={s?.unhealthy} tone={s?.unhealthy ? 'text-danger' : ''} />
        <Stat label="Config failed" value={s?.config_failed} tone={s?.config_failed ? 'text-danger' : ''} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="seg">
          {([['All', undefined], ['Connected', true], ['Offline', false]] as const).map(([label, value]) => (
            <button
              key={label}
              className={connected === value ? 'active' : ''}
              onClick={() => {
                setConnected(value)
                setPage(0)
              }}
            >
              {label}
            </button>
          ))}
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

      <div className="card overflow-auto">
        {agents.error ? (
          <ErrorNote error={agents.error} />
        ) : (
          <table className="table dense">
            <thead>
              <tr>
                <th>Status</th>
                <th>Host</th>
                <th>Service</th>
                <th>Version</th>
                <th>Env</th>
                <th>Region</th>
                <th>Connector</th>
                <th>Auth</th>
                <th>Remote config</th>
                <th>Last seen</th>
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
