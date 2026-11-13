import { useQuery } from '@tanstack/react-query'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api, type MetricPoint } from '../../api-client/client'

interface Series {
  key: keyof MetricPoint
  label: string
  color: string
}

const time = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

function Chart({ title, unit, data, series, format }: { title: string; unit: string; data: object[]; series: Series[]; format: (n: number) => string }) {
  return (
    <div className="card p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="font-medium">{title}</h3>
        <span className="text-xs text-muted">{unit}</span>
      </div>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--c-grid)" vertical={false} />
            <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={time} tick={{ fontSize: 11, fill: 'var(--c-fg-muted)' }} stroke="var(--c-border)" minTickGap={40} />
            <YAxis tickFormatter={format} tick={{ fontSize: 11, fill: 'var(--c-fg-muted)' }} stroke="var(--c-border)" width={48} domain={[0, 'auto']} />
            <Tooltip
              labelFormatter={(v) => new Date(Number(v)).toLocaleTimeString()}
              formatter={(v, name) => [format(Number(v)), name]}
              contentStyle={{ background: 'var(--c-panel)', border: '1px solid var(--c-border)', borderRadius: 6, fontSize: 12 }}
            />
            {series.map((s) => (
              <Line key={s.key} dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={1.5} dot={data.length < 3} isAnimationActive={false} connectNulls />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {series.length > 1 && (
        <div className="mt-2 flex gap-4 text-xs text-muted">
          {series.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

const mib = (n: number) => `${(n / 1048576).toFixed(0)} MiB`
const pct = (n: number) => `${n.toFixed(n < 10 ? 1 : 0)}%`
const perSec = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toFixed(n < 10 ? 1 : 0))

/** CPU, memory and throughput of the collector process over the last few hours, from its own metrics. */
export function CollectorCharts({ uid }: { uid: string }) {
  const { data } = useQuery({ queryKey: ['agents', uid, 'metrics'], queryFn: () => api.agentMetrics(uid), refetchInterval: 30_000 })
  const points = (data?.points ?? []).map((p) => ({ ...p, t: new Date(p.at).getTime() }))
  if (!data) return null
  if (points.length === 0) {
    return (
      <p className="card p-4 text-muted">
        No CPU, memory or throughput charts yet. Collectors installed with the console's install script report these within about two
        minutes of connecting; others need <code className="font-mono text-xs">reports_own_metrics: true</code> in the Supervisor config.
      </p>
    )
  }

  return (
    <section className="space-y-2">
      <h2 className="font-medium">
        Collector process <span className="text-xs font-normal text-muted">last {points.length} samples, about one a minute, kept for 3 hours</span>
      </h2>
      <div className="grid gap-4 lg:grid-cols-3">
        <Chart title="CPU" unit="% of one core" data={points} format={pct} series={[{ key: 'cpu_pct', label: 'CPU', color: 'var(--c-accent)' }]} />
        <Chart
          title="Memory"
          unit="MiB"
          data={points}
          format={mib}
          series={[
            { key: 'rss_bytes', label: 'Resident', color: 'var(--c-accent)' },
            { key: 'heap_bytes', label: 'Heap in use', color: 'var(--c-success)' },
          ]}
        />
        <Chart
          title="Throughput"
          unit="records/s, all signals"
          data={points}
          format={perSec}
          series={[
            { key: 'received', label: 'Received', color: 'var(--c-accent)' },
            { key: 'sent', label: 'Sent', color: 'var(--c-success)' },
            { key: 'failed', label: 'Failed', color: 'var(--c-danger)' },
          ]}
        />
      </div>
    </section>
  )
}
