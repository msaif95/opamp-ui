import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import type { ReactNode } from 'react'
import { api, type Protection, type ProtectionKey, type SystemAlert, type SystemStatus } from '../../api-client/client'
import { Badge, ErrorNote } from '../../components/ui'
import { timeAgo } from '../../lib/time'

const REFRESH_MS = 10_000

interface Copy {
  name: string
  /** What it means while in effect. */
  on: string
  /** What it means while an administrator has it switched off. */
  off: string
  /** What is missing from the deployment when it cannot be switched on. */
  unavailable: string
  /** Asked before switching off, for switches that can lock people or agents out. */
  confirmOff?: string
  /** Off is a risk in production rather than just an unused option. */
  important: boolean
}

function copy(s: SystemStatus): Record<ProtectionKey, Copy> {
  const limits = [
    s.alert_offline_pct > 0 && `${s.alert_offline_pct}% of agents go offline within an hour`,
    s.alert_unhealthy_pct > 0 && `${s.alert_unhealthy_pct}% of connected agents report unhealthy`,
  ]
    .filter(Boolean)
    .join(', or ')
  return {
    sso: {
      name: 'Single sign-on (Okta)',
      on: `Users sign in through ${s.sso_issuer}; roles come from their groups.`,
      off: 'Switched off. The Okta button is hidden and Okta sign-ins are refused. People already signed in stay signed in until their session expires.',
      unavailable: 'Not set up in the deployment (no Okta issuer). Only the local administrator can sign in.',
      confirmOff: 'Switch off single sign-on? Only the local administrator will be able to sign in.',
      important: true,
    },
    local_login: {
      name: 'Local administrator login',
      on: 'Break-glass login is available. Ten failed attempts from one address lock it out for five minutes.',
      off: 'Switched off. If single sign-on becomes unavailable nobody can sign in.',
      unavailable: 'Not set up in the deployment (no local administrator password).',
      confirmOff: 'Switch off the local administrator login? If Okta becomes unavailable nobody will be able to sign in.',
      important: false,
    },
    agent_tls: {
      name: 'TLS for agent connections',
      on: 'Agents connect over TLS. Set in the deployment; it cannot be changed here.',
      off: '',
      unavailable: 'Agents connect in plaintext. Acceptable for local development only. Set in the deployment; it cannot be changed here.',
      important: true,
    },
    agent_mtls: {
      name: 'Agent client certificates (mTLS)',
      on: 'Agents may authenticate with a certificate from the trusted CA, or with an API key.',
      off: 'Switched off. Certificates are ignored: agents need an API key, and agents connected with a certificate are disconnected within about 30 seconds.',
      unavailable: 'Not set up in the deployment (no client CA). Agents authenticate with API keys only.',
      confirmOff:
        'Switch off client certificates? Every agent that connects with a certificate is disconnected within about 30 seconds and stays out until this is switched back on.',
      important: false,
    },
    alert_delivery: {
      name: 'Alert delivery',
      on: 'Alerts are sent to the configured webhook.',
      off: 'Switched off. Alerts are still listed below but not sent to the webhook.',
      unavailable: 'Not set up in the deployment (no webhook). Alerts are only listed on this page.',
      important: true,
    },
    telemetry: {
      name: 'Monitoring export',
      on: 'The backend exports its own metrics and traces.',
      off: 'Switched off. Metrics and traces are collected but not sent.',
      unavailable: 'Not set up in the deployment (no export endpoint).',
      important: true,
    },
    rebalancing: {
      name: 'Connection rebalancing',
      on: 'A replica holding well over its share closes some agent connections so they reconnect to emptier replicas.',
      off: 'Switched off. A restarted or added replica stays under-loaded until agents happen to reconnect.',
      unavailable: '',
      important: false,
    },
    fleet_health_alerts: {
      name: 'Fleet health alerts',
      on: `Alerts when ${limits}.`,
      off: 'Switched off. No alert is raised when agents go offline or turn unhealthy.',
      unavailable: 'Not set up in the deployment (both limits are 0).',
      important: true,
    },
  }
}

function Switch({ on, disabled, label, onChange }: { on: boolean; disabled: boolean; label: string; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={clsx(
        'relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        on ? 'bg-accent' : 'bg-border-strong',
      )}
    >
      <span className={clsx('absolute top-0.5 h-4 w-4 rounded-full bg-panel shadow transition-all', on ? 'left-[18px]' : 'left-0.5')} />
    </button>
  )
}

function ProtectionRow({ p, text }: { p: Protection; text: Copy }) {
  const qc = useQueryClient()
  const set = useMutation({
    mutationFn: (enabled: boolean) => api.setProtection(p.key, enabled),
    onSettled: () => qc.invalidateQueries({ queryKey: ['system'] }),
  })
  const inEffect = p.available && p.enabled
  const toggle = () => {
    if (inEffect && text.confirmOff && !confirm(text.confirmOff)) return
    set.mutate(!p.enabled)
  }
  return (
    <li className="flex items-start gap-4 border-b border-border px-4 py-2.5 last:border-b-0">
      <span className="w-28 shrink-0 pt-0.5">
        {inEffect ? (
          <Badge tone="success">On</Badge>
        ) : p.available ? (
          <Badge tone={text.important ? 'danger' : 'neutral'}>Switched off</Badge>
        ) : (
          <Badge tone={text.important ? 'danger' : 'neutral'}>Not set up</Badge>
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-medium">{text.name}</div>
        <div className="text-xs text-muted">{inEffect ? text.on : p.available ? text.off : text.unavailable}</div>
        {p.updated_by && p.updated_at && (
          <div className="text-xs text-faint">
            Last changed by {p.updated_by}, {timeAgo(p.updated_at)}
          </div>
        )}
        {set.error && <div className="text-xs text-danger">{set.error.message}</div>}
      </div>
      {!p.locked && (
        <Switch
          on={inEffect}
          // Something not set up in the deployment cannot be switched on from here.
          disabled={!p.available || set.isPending}
          label={text.name}
          onChange={toggle}
        />
      )}
    </li>
  )
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
  if (a.delivery === 'disabled') return <Badge tone="warning">Delivery switched off</Badge>
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

  const texts = copy(data.status)
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

      <Section title="Protections" hint="Switches apply to every backend replica within a few seconds, without a restart, and are recorded in the audit log. A protection that is not set up in the deployment has to be configured there first.">
        <ul>
          {data.protections.map((p) => (
            <ProtectionRow key={p.key} p={p} text={texts[p.key]} />
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
