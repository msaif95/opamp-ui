import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { api, type SystemAlert, type SystemStatus } from '../../api-client/client'
import { Badge, ErrorNote } from '../../components/ui'
import { timeAgo } from '../../lib/time'

const REFRESH_MS = 10_000

interface Check {
  name: string
  on: boolean
  /** Off is a risk in production (shown in red) rather than just an unused option. */
  required: boolean
  detail: string
}

function checks(s: SystemStatus): Check[] {
  return [
    {
      name: 'Single sign-on (Okta)',
      on: s.sso,
      required: true,
      detail: s.sso ? `Users sign in through ${s.sso_issuer}; roles come from their groups.` : 'Not configured. Only the local administrator can sign in.',
    },
    {
      name: 'Local administrator login',
      on: s.local_login,
      required: false,
      detail: s.local_login
        ? 'Break-glass login is available. Ten failed attempts from one address lock it out for five minutes.'
        : 'Disabled. If single sign-on is unavailable nobody can sign in.',
    },
    {
      name: 'TLS for agent connections',
      on: s.agent_tls,
      required: true,
      detail: s.agent_tls ? 'Agents connect over TLS.' : 'Agents connect in plaintext. Acceptable for local development only.',
    },
    {
      name: 'Agent client certificates (mTLS)',
      on: s.agent_mtls,
      required: false,
      detail: s.agent_mtls
        ? 'Agents may authenticate with a certificate from the trusted CA, or with an API key.'
        : 'Off. Agents can authenticate with API keys only.',
    },
    {
      name: 'Alert delivery',
      on: s.alert_webhook,
      required: true,
      detail: s.alert_webhook ? 'Bulk push alerts are sent to the configured webhook.' : 'No webhook configured. Alerts are only listed on this page.',
    },
    {
      name: 'Monitoring export',
      on: s.telemetry,
      required: true,
      detail: s.telemetry ? "The backend exports its own metrics and traces." : 'Off. The backend is not exporting metrics or traces.',
    },
    {
      name: 'Connection rebalancing',
      on: s.rebalancing,
      required: false,
      detail: s.rebalancing
        ? 'A replica holding well over its share closes some agent connections so they reconnect to emptier replicas.'
        : 'Off. A restarted or added replica stays under-loaded until agents happen to reconnect.',
    },
    {
      name: 'Fleet health alerts',
      on: s.alert_offline_pct > 0 || s.alert_unhealthy_pct > 0,
      required: true,
      detail:
        [
          s.alert_offline_pct > 0 && `${s.alert_offline_pct}% of agents go offline within an hour`,
          s.alert_unhealthy_pct > 0 && `${s.alert_unhealthy_pct}% of connected agents report unhealthy`,
        ]
          .filter(Boolean)
          .join(', or ')
          .replace(/^(.)/, (c) => `Alerts when ${c}`)
          .replace(/(.)$/, '$1.') || 'Off. No alert is raised when agents go offline or turn unhealthy.',
    },
  ]
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="card overflow-auto">
      <div className="border-b border-border px-4 py-2">
        <h2 className="font-medium">{title}</h2>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
      {children}
    </section>
  )
}

function delivery(a: SystemAlert) {
  if (a.delivery === 'sent') return <Badge tone="success">Sent</Badge>
  if (a.delivery === 'failed') return <Badge tone="danger">Delivery failed</Badge>
  return <Badge tone="neutral">Not sent</Badge>
}

function uptime(iso: string) {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`
  return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`
}

export function System() {
  const { data, error } = useQuery({ queryKey: ['system'], queryFn: api.system, refetchInterval: REFRESH_MS })
  if (error) return <ErrorNote error={error} />
  if (!data) return <p className="text-muted">Loading…</p>

  const total = data.replicas.reduce((n, r) => n + r.connections, 0)
  // With several replicas, one holding far fewer agents than its share usually just restarted.
  const share = data.replicas.length > 0 ? total / data.replicas.length : 0

  return (
    <div className="space-y-4">
      <div className="flex items-baseline gap-3">
        <h1 className="text-lg font-semibold">System</h1>
        <span className="font-mono text-xs text-muted">backend {data.status.version}</span>
      </div>
      {data.status.dev_mode && (
        <p className="card border-warning p-3 text-warning">
          Development mode is on: the backend's production safety checks (TLS for agents, strong secrets) are disabled. Do not run a
          production fleet like this.
        </p>
      )}

      <Section title="Protections" hint="How this deployment is configured. Change these in the backend's environment or Helm values.">
        <ul>
          {checks(data.status).map((c) => (
            <li key={c.name} className="flex items-start gap-4 border-b border-border px-4 py-2.5 last:border-b-0">
              <span className="w-16 shrink-0 pt-0.5">
                {c.on ? <Badge tone="success">On</Badge> : <Badge tone={c.required ? 'danger' : 'neutral'}>Off</Badge>}
              </span>
              <div>
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-muted">{c.detail}</div>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title="Backend replicas"
        hint={`${data.replicas.length} running, holding ${total.toLocaleString()} agent connections. Agents silent for ${data.status.agent_offline_after_seconds}s are marked offline.`}
      >
        <table className="table">
          <thead>
            <tr>
              <th>Replica</th>
              <th>Agent connections</th>
              <th>Share</th>
              <th>Up for</th>
              <th>Last report</th>
            </tr>
          </thead>
          <tbody>
            {data.replicas.map((r) => (
              <tr key={r.id}>
                <td className="font-mono text-xs">{r.id}</td>
                <td>{r.connections.toLocaleString()}</td>
                <td>
                  {total > 0 ? `${Math.round((r.connections / total) * 100)}%` : '–'}
                  {data.replicas.length > 1 && r.connections < share / 2 && (
                    <span className="ml-2">
                      <Badge tone="warning">Under-loaded</Badge>
                    </span>
                  )}
                </td>
                <td>{uptime(r.started_at)}</td>
                <td className="text-muted">{timeAgo(r.updated_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Recent alerts" hint="The last 100 alerts: bulk pushes that paused, rolled back or finished with failures, and fleet health.">
        {data.alerts.length === 0 ? (
          <p className="p-4 text-muted">No alerts yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>When</th>
                <th>Alert</th>
                <th>Delivery</th>
              </tr>
            </thead>
            <tbody>
              {data.alerts.map((a, i) => (
                <tr key={`${a.at}-${i}`}>
                  <td className="whitespace-nowrap text-muted">{new Date(a.at).toLocaleString()}</td>
                  <td>{a.text}</td>
                  <td>{delivery(a)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </div>
  )
}
