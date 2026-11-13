import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api, CAP_REPORTS_OWN_METRICS, type Agent, type MetricSeries } from '../../api-client/client'
import { ErrorNote } from '../../components/ui'
import { CollectorCharts } from './CollectorCharts'

const COLORS = ['var(--c-accent)', 'var(--c-success)', 'var(--c-danger)', 'var(--c-warning)', '#0ea5a4', '#a855f7', '#ec4899', '#64748b']
const clock = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

function compact(n: number) {
  const a = Math.abs(n)
  if (a >= 1e9) return `${(n / 1e9).toFixed(1)}G`
  if (a >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (a >= 1e3) return `${(n / 1e3).toFixed(1)}k`
  if (a === 0) return '0'
  return a < 0.01 ? n.toExponential(1) : n.toFixed(a < 10 ? 2 : 0)
}

const KIND = { gauge: '', rate: 'per second', average: 'average per report' } as const
/** What distinguishes one line from the others on the same chart. */
const lineLabel = (s: MetricSeries) =>
  Object.entries(s.attributes ?? {})
    .map(([k, v]) => `${k}=${v}`)
    .join(', ') || s.name

/** One chart for one metric, with a line per combination of attribute values. */
function MetricChart({ name, series, data }: { name: string; series: MetricSeries[]; data: Record<string, number>[] }) {
  const first = series[0]
  const unit = [first.unit, KIND[first.kind]].filter(Boolean).join(' ')
  return (
    <div className="card p-4">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h3 className="min-w-0 truncate font-mono text-xs font-medium" title={first.description || name}>
          {name}
        </h3>
        <span className="shrink-0 text-xs text-muted">{unit}</span>
      </div>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }} accessibilityLayer={false}>
            <CartesianGrid stroke="var(--c-grid)" vertical={false} />
            <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={clock} tick={{ fontSize: 11, fill: 'var(--c-fg-muted)' }} stroke="var(--c-border)" minTickGap={40} />
            <YAxis tickFormatter={compact} tick={{ fontSize: 11, fill: 'var(--c-fg-muted)' }} stroke="var(--c-border)" width={48} domain={[0, 'auto']} />
            <Tooltip
              labelFormatter={(v) => new Date(Number(v)).toLocaleTimeString()}
              formatter={(v, label) => [compact(Number(v)), label]}
              contentStyle={{ background: 'var(--c-panel)', border: '1px solid var(--c-border)', borderRadius: 6, fontSize: 12 }}
            />
            {series.map((s, i) => (
              <Line key={s.id} dataKey={s.id} name={lineLabel(s)} stroke={COLORS[i % COLORS.length]} strokeWidth={1.5} dot={data.length < 3} isAnimationActive={false} connectNulls />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {series.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          {series.map((s, i) => (
            <span key={s.id} className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
              {lineLabel(s)}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/** Every metric the collector reports about itself, one chart each, under the headline CPU, memory and throughput charts. */
export function AgentMetrics({ agent }: { agent: Agent }) {
  const [text, setText] = useState('')
  const { data, error } = useQuery({ queryKey: ['agents', agent.instance_uid, 'metrics', 'all'], queryFn: () => api.agentAllMetrics(agent.instance_uid), refetchInterval: 30_000 })
  const q = text.trim().toLowerCase()
  const byName = new Map<string, MetricSeries[]>()
  for (const s of data?.series ?? []) byName.set(s.name, [...(byName.get(s.name) ?? []), s])
  const names = [...byName.keys()].filter((n) => !q || n.toLowerCase().includes(q) || byName.get(n)!.some((s) => lineLabel(s).toLowerCase().includes(q)))
  const points = (data?.samples ?? []).map((p) => ({ t: new Date(p.at).getTime(), ...p.values }))
  const reports = (agent.capabilities & CAP_REPORTS_OWN_METRICS) !== 0

  if (error) return <ErrorNote error={error} />
  if (data && data.series.length === 0) {
    return (
      <p className="card p-4 text-muted">
        {reports ? (
          'No metrics yet. They arrive within about two minutes of the collector connecting.'
        ) : (
          <>
            This collector does not send its metrics. Collectors installed with the console's install script do; others need{' '}
            <code className="font-mono text-xs">reports_own_metrics: true</code> under <code className="font-mono text-xs">capabilities</code> in
            the Supervisor config, then a Supervisor restart.
          </>
        )}
      </p>
    )
  }
  return (
    <>
      <CollectorCharts uid={agent.instance_uid} />
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div>
          <h2 className="font-medium">
            All reported metrics <span className="text-xs font-normal text-muted">{names.length} of {byName.size} metrics, about one sample a minute, kept for 3 hours</span>
          </h2>
          <p className="max-w-4xl text-xs text-muted">
            Everything the collector process reports about itself. Counters are shown as a rate per second and histograms as their average
            and count; gauges are shown as reported.
            {data && data.series.length >= data.max_series && ` Only the first ${data.max_series} series are kept.`}
          </p>
        </div>
        <input className="input w-64 shrink-0" type="search" placeholder="Filter metrics" value={text} onChange={(e) => setText(e.target.value)} aria-label="Filter metrics" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {names.map((n) => (
          <MetricChart key={n} name={n} series={byName.get(n)!} data={points} />
        ))}
      </div>
      {data && names.length === 0 && <p className="card p-6 text-center text-muted">No metric matches the filter.</p>}
    </>
  )
}
