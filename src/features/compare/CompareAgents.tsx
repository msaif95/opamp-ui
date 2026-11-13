import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { ArrowLeftRight } from 'lucide-react'
import { useEffect, useId, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, type Agent } from '../../api-client/client'
import { Breadcrumbs } from '../../components/Breadcrumbs'
import { ProjectName } from '../../components/ProjectSelect'
import { Tabs } from '../../components/Tabs'
import { AgentStatus, ConfigStatus, ErrorNote } from '../../components/ui'
import { CollectorCharts } from '../agent-detail/CollectorCharts'
import { DiffView } from '../config-editor/parts'

const hostOf = (a: Agent) => a.attributes['host.name'] ?? a.instance_uid

/** Chooses one collector by typing part of its host name, IP address, UID or any attribute. */
function AgentPicker({ label, uid, onPick }: { label: string; uid: string; onPick: (uid: string) => void }) {
  const listId = useId()
  const [text, setText] = useState('')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  useEffect(() => {
    const timer = setTimeout(() => setQuery(text.trim()), 200)
    return () => clearTimeout(timer)
  }, [text])
  const chosen = useQuery({ queryKey: ['agents', uid], queryFn: () => api.agent(uid), enabled: uid !== '' })
  const found = useQuery({
    queryKey: ['agents', 'search', query],
    queryFn: () => api.agents({ limit: 8, offset: 0, sort: 'name', order: 'asc', attrs: {}, search: query }),
    enabled: open,
    placeholderData: (previous) => previous,
  })
  const results = found.data?.agents ?? []
  const pick = (a: Agent | undefined) => {
    if (!a) return
    onPick(a.instance_uid)
    setText('')
    setOpen(false)
  }
  return (
    <div className="relative min-w-0 flex-1">
      <label className="block space-y-1">
        <span className="block text-xs text-muted">{label}</span>
        <input
          className="input w-full font-mono text-xs"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && results[active] ? `${listId}-${active}` : undefined}
          placeholder={chosen.data ? hostOf(chosen.data) : 'Type a host name, IP address or UID'}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setOpen(true)
            setActive(0)
          }}
          onFocus={() => setOpen(true)}
          // Leave time for a click on a result to land before the list closes.
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault()
              setOpen(true)
              setActive(Math.min(results.length - 1, Math.max(0, active + (e.key === 'ArrowDown' ? 1 : -1))))
            } else if (e.key === 'Enter' && open) {
              e.preventDefault()
              pick(results[active])
            } else if (e.key === 'Escape') {
              setOpen(false)
            }
          }}
        />
      </label>
      {open && (
        <ul id={listId} role="listbox" aria-label={label} className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-md border border-border bg-panel p-1 shadow-lg">
          {results.map((a, i) => (
            <li
              key={a.instance_uid}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={clsx('flex cursor-pointer items-center gap-2 rounded px-2 py-1.5', i === active && 'bg-accent-soft')}
              onMouseEnter={() => setActive(i)}
              // mousedown, so it fires before the input loses focus.
              onMouseDown={(e) => {
                e.preventDefault()
                pick(a)
              }}
            >
              <span className="min-w-0 flex-1 truncate font-mono text-xs">{hostOf(a)}</span>
              <AgentStatus agent={a} />
            </li>
          ))}
          {results.length === 0 && <li className="px-2 py-3 text-center text-xs text-muted">{found.isFetching ? 'Searching…' : 'No collector matches.'}</li>}
        </ul>
      )}
    </div>
  )
}

function Rows({ rows, onlyDifferences }: { rows: { label: string; a: ReactNode; b: ReactNode; differs: boolean }[]; onlyDifferences: boolean }) {
  const shown = rows.filter((r) => !onlyDifferences || r.differs)
  if (shown.length === 0) return <p className="p-4 text-muted">No differences.</p>
  return (
    <table className="table dense">
      <thead>
        <tr>
          <th className="w-56">
            <span className="sr-only">Field</span>
          </th>
          <th>A</th>
          <th>B</th>
        </tr>
      </thead>
      <tbody>
        {shown.map((r) => (
          <tr key={r.label} className={r.differs ? 'bg-warning/10' : undefined}>
            <th scope="row" className="text-left font-mono text-xs font-normal text-muted">
              {r.label}
              {r.differs && <span className="sr-only"> (differs)</span>}
            </th>
            <td className="break-all">{r.a}</td>
            <td className="break-all">{r.b}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

const dash = <span className="text-muted">–</span>

/** Two collectors side by side: state, attributes, running config and process metrics, with differences marked. */
export function CompareAgents() {
  const [params, setParams] = useSearchParams()
  const a = params.get('a') ?? ''
  const b = params.get('b') ?? ''
  const [onlyDifferences, setOnlyDifferences] = useState(true)
  const set = (side: 'a' | 'b', uid: string) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        next.set(side, uid)
        return next
      },
      { replace: true },
    )
  const left = useQuery({ queryKey: ['agents', a], queryFn: () => api.agent(a), enabled: a !== '' })
  const right = useQuery({ queryKey: ['agents', b], queryFn: () => api.agent(b), enabled: b !== '' })
  const A = left.data
  const B = right.data

  const state =
    A && B
      ? [
          { label: 'Status', a: <AgentStatus agent={A} />, b: <AgentStatus agent={B} />, differs: A.connected !== B.connected || A.healthy !== B.healthy || A.paused !== B.paused },
          { label: 'Health detail', a: A.health_last_error || A.health_status || dash, b: B.health_last_error || B.health_status || dash, differs: (A.health_last_error || A.health_status) !== (B.health_last_error || B.health_status) },
          { label: 'Project', a: <ProjectName id={A.project_id} />, b: <ProjectName id={B.project_id} />, differs: A.project_id !== B.project_id },
          { label: 'Collector version', a: A.agent_version ?? dash, b: B.agent_version ?? dash, differs: A.agent_version !== B.agent_version },
          {
            label: 'Assigned config',
            a: A.desired_config ? `${A.desired_config.template_name} v${A.desired_config.version}` : dash,
            b: B.desired_config ? `${B.desired_config.template_name} v${B.desired_config.version}` : dash,
            differs: A.desired_config?.version_id !== B.desired_config?.version_id,
          },
          { label: 'Config status', a: <ConfigStatus status={A.remote_config_status} />, b: <ConfigStatus status={B.remote_config_status} />, differs: A.remote_config_status !== B.remote_config_status },
          { label: 'Config error', a: A.remote_config_error || dash, b: B.remote_config_error || dash, differs: (A.remote_config_error ?? '') !== (B.remote_config_error ?? '') },
          { label: 'Sign-in', a: A.auth_mode === 'mtls' ? 'Client certificate' : 'API key', b: B.auth_mode === 'mtls' ? 'Client certificate' : 'API key', differs: A.auth_mode !== B.auth_mode },
          { label: 'Last seen', a: new Date(A.last_seen).toLocaleString(), b: new Date(B.last_seen).toLocaleString(), differs: false },
        ]
      : []
  const attributes =
    A && B
      ? [...new Set([...Object.keys(A.attributes), ...Object.keys(B.attributes)])].sort().map((k) => ({
          label: k,
          a: A.attributes[k] ?? dash,
          b: B.attributes[k] ?? dash,
          differs: A.attributes[k] !== B.attributes[k],
        }))
      : []
  const differing = state.filter((r) => r.differs).length + attributes.filter((r) => r.differs).length
  const configsDiffer = A && B ? (A.effective_config ?? '') !== (B.effective_config ?? '') : false

  return (
    <div className="space-y-4">
      <Breadcrumbs items={[{ label: 'Fleet', to: '/agents' }, { label: 'Compare collectors' }]} />
      <h1 className="text-lg font-semibold">Compare collectors</h1>
      <div className="card flex flex-wrap items-end gap-3 p-4">
        <AgentPicker label="Collector A" uid={a} onPick={(uid) => set('a', uid)} />
        <button
          className="btn"
          disabled={!a && !b}
          onClick={() => setParams((previous) => {
            const next = new URLSearchParams(previous)
            next.set('a', b)
            next.set('b', a)
            return next
          }, { replace: true })}
          aria-label="Swap A and B"
          title="Swap A and B"
        >
          <ArrowLeftRight size={14} />
        </button>
        <AgentPicker label="Collector B" uid={b} onPick={(uid) => set('b', uid)} />
      </div>

      {left.error && <ErrorNote error={left.error} />}
      {right.error && <ErrorNote error={right.error} />}
      {!A || !B ? (
        !left.error && !right.error && <p className="card p-6 text-center text-muted">Choose two collectors to see what differs between them.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            {[
              ['A', A],
              ['B', B],
            ].map(([side, agent]) => (
              <Link key={side as string} to={`/agents/${(agent as Agent).instance_uid}`} className="card flex items-center gap-3 px-4 py-3 hover:border-accent">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent">{side as string}</span>
                <span className="min-w-0 flex-1 truncate font-mono text-xs">{hostOf(agent as Agent)}</span>
                <AgentStatus agent={agent as Agent} />
              </Link>
            ))}
          </div>
          <Tabs
            label="What to compare"
            tabs={[
              {
                value: 'details',
                label: 'State and attributes',
                count: differing,
                content: (
                  <>
                    <label className="flex items-center gap-2 text-xs">
                      <input type="checkbox" className="accent-[var(--c-accent)]" checked={onlyDifferences} onChange={(e) => setOnlyDifferences(e.target.checked)} />
                      Show only what differs
                    </label>
                    <section className="card overflow-auto">
                      <h2 className="border-b border-border px-4 py-2 font-medium">State</h2>
                      <Rows rows={state} onlyDifferences={onlyDifferences} />
                    </section>
                    <section className="card overflow-auto">
                      <h2 className="border-b border-border px-4 py-2 font-medium">Attributes</h2>
                      <Rows rows={attributes} onlyDifferences={onlyDifferences} />
                    </section>
                  </>
                ),
              },
              {
                value: 'config',
                label: configsDiffer ? 'Running config (differs)' : 'Running config',
                content: (
                  <section className="card overflow-auto">
                    <div className="border-b border-border px-4 py-2">
                      <h2 className="font-medium">Running config</h2>
                      <p className="text-xs text-muted">
                        The config each collector reports it is running. Lines marked − are only in A; lines marked + are only in B.
                      </p>
                    </div>
                    {A.effective_config || B.effective_config ? (
                      <DiffView before={A.effective_config ?? ''} after={B.effective_config ?? ''} />
                    ) : (
                      <p className="p-4 text-muted">Neither collector has reported its running config.</p>
                    )}
                  </section>
                ),
              },
              {
                value: 'metrics',
                label: 'Process metrics',
                content: (
                  <>
                    {[
                      ['A', A],
                      ['B', B],
                    ].map(([side, agent]) => (
                      <div key={side as string} className="space-y-2">
                        <h2 className="font-medium">
                          {side as string}: <span className="font-mono text-xs">{hostOf(agent as Agent)}</span>
                        </h2>
                        <CollectorCharts uid={(agent as Agent).instance_uid} />
                      </div>
                    ))}
                  </>
                ),
              },
            ]}
          />
        </>
      )}
    </div>
  )
}
