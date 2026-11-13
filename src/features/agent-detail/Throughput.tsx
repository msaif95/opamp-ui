import type { Agent } from '../../api-client/client'
import { timeAgo } from '../../lib/time'

const signals = [
  { key: 'logs', label: 'Logs', unit: 'records/s' },
  { key: 'metrics', label: 'Metrics', unit: 'points/s' },
  { key: 'traces', label: 'Traces', unit: 'spans/s' },
]

function rate(n: number | undefined) {
  if (n === undefined) return '–'
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return n >= 10 ? n.toFixed(0) : n.toFixed(1)
}

/** What the collector's pipelines are receiving, sending and failing to send, from its own counters. */
export function Throughput({ agent }: { agent: Agent }) {
  const t = agent.throughput
  const rates = t?.rates ?? {}
  const active = signals.filter((s) => ['received', 'sent', 'failed', 'refused'].some((d) => rates[d]?.[s.key] !== undefined))

  return (
    <section className="card">
      <div className="flex items-baseline justify-between border-b border-border px-4 py-2">
        <h2 className="font-medium">Throughput</h2>
        {t && <span className="text-xs text-muted">reported {timeAgo(t.at)}</span>}
      </div>
      {!t ? (
        <p className="p-4 text-muted">
          This collector is not reporting its pipeline counters. Collectors installed with the console's install script report them
          automatically; others need <code className="font-mono text-xs">reports_own_metrics: true</code> in the Supervisor config.
        </p>
      ) : active.length === 0 ? (
        <p className="p-4 text-muted">Waiting for a second report to work out rates, or no pipeline is carrying data yet.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Signal</th>
              <th>Received</th>
              <th>Sent</th>
              <th>Reduced by</th>
              <th>Failed to send</th>
              <th>Refused at intake</th>
            </tr>
          </thead>
          <tbody>
            {active.map((s) => {
              const received = rates.received?.[s.key]
              const sent = rates.sent?.[s.key]
              const failed = rates.failed?.[s.key] ?? 0
              const refused = rates.refused?.[s.key] ?? 0
              // With several destinations "sent" counts each copy, so it can exceed "received"; no reduction then.
              const reduced = received && sent !== undefined && sent < received ? `${Math.round((1 - sent / received) * 100)}%` : '–'
              return (
                <tr key={s.key}>
                  <td>{s.label}</td>
                  <td>
                    {rate(received)} <span className="text-xs text-muted">{s.unit}</span>
                  </td>
                  <td>{rate(sent)}</td>
                  <td>{reduced}</td>
                  <td className={failed > 0 ? 'text-danger' : 'text-muted'}>{rate(failed)}</td>
                  <td className={refused > 0 ? 'text-danger' : 'text-muted'}>{rate(refused)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </section>
  )
}
