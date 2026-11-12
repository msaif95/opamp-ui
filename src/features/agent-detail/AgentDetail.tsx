import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, CAP_ACCEPTS_REMOTE_CONFIG } from '../../api-client/client'
import { useAuth } from '../../auth/AuthProvider'
import { AgentStatus, Badge, ConfigStatus, ErrorNote } from '../../components/ui'
import { timeAgo } from '../../lib/time'
import { PushConfig } from './PushConfig'

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-4 border-b border-border px-4 py-2 last:border-b-0">
      <dt className="w-44 shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 break-all">{children}</dd>
    </div>
  )
}

export function AgentDetail() {
  const { uid = '' } = useParams()
  const { can } = useAuth()
  const { data: a, error, isLoading } = useQuery({ queryKey: ['agents', uid], queryFn: () => api.agent(uid) })

  if (isLoading) return <p className="text-muted">Loading…</p>
  if (error || !a) return <ErrorNote error={error} />

  return (
    <div className="space-y-4">
      <Link to="/agents" className="inline-flex items-center gap-1 text-xs text-muted hover:text-fg">
        <ArrowLeft size={13} /> Fleet
      </Link>
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold">{a.attributes['host.name'] ?? a.instance_uid}</h1>
        <AgentStatus agent={a} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card">
          <h2 className="border-b border-border px-4 py-2 font-medium">Overview</h2>
          <dl>
            <Row label="Instance UID">
              <span className="font-mono text-xs">{a.instance_uid}</span>
            </Row>
            <Row label="Connector type">{a.connector_type}</Row>
            <Row label="Auth mode">{a.auth_mode === 'mtls' ? 'mTLS' : 'API key'}</Row>
            <Row label="Version">{a.agent_version ?? '–'}</Row>
            <Row label="Health">
              {a.health_status || '–'}
              {a.health_last_error && <div className="text-danger">{a.health_last_error}</div>}
            </Row>
            <Row label="First seen">{new Date(a.first_seen).toLocaleString()}</Row>
            <Row label="Last seen">
              {new Date(a.last_seen).toLocaleString()} ({timeAgo(a.last_seen)})
            </Row>
          </dl>
        </section>

        <section className="card">
          <h2 className="border-b border-border px-4 py-2 font-medium">Attributes</h2>
          <dl>
            {Object.entries(a.attributes)
              .sort(([x], [y]) => x.localeCompare(y))
              .map(([k, v]) => (
                <Row key={k} label={k}>
                  {v}
                </Row>
              ))}
          </dl>
        </section>
      </div>

      <section className="card">
        <h2 className="border-b border-border px-4 py-2 font-medium">Remote config</h2>
        <dl>
          <Row label="Assigned">
            {a.desired_config ? (
              <span className="inline-flex items-center gap-2">
                <Link to={`/configs/${a.desired_config.template_id}`} className="text-accent hover:underline">
                  {a.desired_config.template_name} v{a.desired_config.version}
                </Link>
                {a.desired_config.in_sync ? <Badge tone="success">In sync</Badge> : <Badge tone="warning">Not in sync</Badge>}
              </span>
            ) : (
              'None'
            )}
          </Row>
          <Row label="Last reported status">
            <ConfigStatus status={a.remote_config_status} />
            {a.remote_config_error && <div className="text-danger">{a.remote_config_error}</div>}
          </Row>
        </dl>
        {(a.capabilities & CAP_ACCEPTS_REMOTE_CONFIG) === 0 ? (
          <p className="border-t border-border px-4 py-3 text-muted">This agent does not accept remote config.</p>
        ) : (
          can('operator') && <PushConfig key={a.desired_config?.version_id ?? 'none'} agent={a} />
        )}
      </section>

      <section className="card">
        <h2 className="border-b border-border px-4 py-2 font-medium">Effective config</h2>
        {a.effective_config ? (
          <pre className="overflow-auto p-4 font-mono text-xs">{a.effective_config}</pre>
        ) : (
          <p className="p-4 text-muted">The agent has not reported an effective config.</p>
        )}
      </section>
    </div>
  )
}
