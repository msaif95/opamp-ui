import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { useState } from 'react'
import { api, CAP_REPORTS_OWN_TRACES, type Agent, type TraceSpan } from '../../api-client/client'
import { Select } from '../../components/Select'
import { Badge, ErrorNote } from '../../components/ui'

const STATUS = [
  { value: '', label: 'All spans' },
  { value: 'error', label: 'Errors only' },
]
const took = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : ms >= 1 ? `${ms.toFixed(1)} ms` : `${(ms * 1000).toFixed(0)} µs`)

/** The collector's own recent spans, newest first: what it was doing internally, and how long each step took. */
export function AgentTraces({ agent }: { agent: Agent }) {
  const [status, setStatus] = useState('')
  const [text, setText] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const { data, error } = useQuery({ queryKey: ['agents', agent.instance_uid, 'traces'], queryFn: () => api.agentTraces(agent.instance_uid), refetchInterval: 15_000 })
  const q = text.trim().toLowerCase()
  const matches = (s: TraceSpan) =>
    (status === '' || s.status === 'error') &&
    (!q || s.name.toLowerCase().includes(q) || (s.scope ?? '').toLowerCase().includes(q) || s.trace_id.includes(q) || Object.values(s.attributes ?? {}).some((v) => v.toLowerCase().includes(q)))
  const spans = (data?.spans ?? []).filter(matches)
  const slowest = Math.max(1, ...spans.map((s) => s.duration_ms))
  const reports = (agent.capabilities & CAP_REPORTS_OWN_TRACES) !== 0

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-4xl text-xs text-muted">
          Spans the collector records about its own work, such as receiving, processing and exporting a batch. They are not your
          applications' traces. The newest {data?.kept ?? 300} spans are kept for {data?.kept_hours ?? 24} hours after the last one arrives.
        </p>
        <div className="flex shrink-0 gap-2">
          <input className="input w-56" type="search" placeholder="Filter by name, scope or trace ID" value={text} onChange={(e) => setText(e.target.value)} aria-label="Filter spans" />
          <Select className="w-40" value={status} onChange={setStatus} options={STATUS} aria-label="Status" />
        </div>
      </div>
      {error ? (
        <ErrorNote error={error} />
      ) : data?.spans.length === 0 ? (
        <p className="card p-4 text-muted">
          {reports ? (
            'No spans yet. A collector only records spans while data flows through its pipelines, and sends them within about a minute.'
          ) : (
            <>
              This collector does not send its traces. Collectors installed with the console's install script do; others need{' '}
              <code className="font-mono text-xs">reports_own_traces: true</code> under <code className="font-mono text-xs">capabilities</code> in
              the Supervisor config, then a Supervisor restart.
            </>
          )}
        </p>
      ) : (
        <div className="card overflow-auto">
          <table className="table dense">
            <thead>
              <tr>
                <th className="w-44">Started</th>
                <th>Span</th>
                <th className="w-20">Status</th>
                <th className="w-64">Duration</th>
              </tr>
            </thead>
            <tbody>
              {spans.map((s) => {
                const id = s.trace_id + s.span_id
                return (
                  <tr key={id} className={clsx('cursor-pointer', s.status === 'error' && 'bg-danger/5')} onClick={() => setOpen(open === id ? null : id)}>
                    <td className="whitespace-nowrap align-top font-mono text-xs text-muted">{new Date(s.start).toLocaleString()}</td>
                    <td className="align-top">
                      <button className="text-left font-mono text-xs" aria-expanded={open === id}>
                        {s.name}
                      </button>
                      <div className="text-xs text-muted">{[s.scope, s.kind].filter(Boolean).join(' · ')}</div>
                      {open === id && (
                        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 font-mono text-xs">
                          {[
                            ['trace', s.trace_id],
                            ['span', s.span_id],
                            ...(s.parent_id ? [['parent', s.parent_id]] : []),
                            ...(s.status_message ? [['status message', s.status_message]] : []),
                            ...Object.entries(s.attributes ?? {}),
                          ].map(([k, v]) => (
                            <div key={k} className="contents">
                              <dt className="text-muted">{k}</dt>
                              <dd className="break-all">{v}</dd>
                            </div>
                          ))}
                        </dl>
                      )}
                    </td>
                    <td className="align-top">
                      <Badge tone={s.status === 'error' ? 'danger' : s.status === 'ok' ? 'success' : 'neutral'}>{s.status === 'unset' ? 'ok' : s.status}</Badge>
                    </td>
                    <td className="align-top">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-hover" aria-hidden>
                          <div className={clsx('h-full rounded-full', s.status === 'error' ? 'bg-danger' : 'bg-accent')} style={{ width: `${Math.max(2, (s.duration_ms / slowest) * 100)}%` }} />
                        </div>
                        <span className="w-16 shrink-0 text-right font-mono text-xs">{took(s.duration_ms)}</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {spans.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-muted">
                    No spans match the filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
