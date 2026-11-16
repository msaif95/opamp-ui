import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { GitCompareArrows, Tag } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, CAP_ACCEPTS_REMOTE_CONFIG, type Agent } from '../../api-client/client'
import { useAuth } from '../../auth/AuthProvider'
import { Tabs } from '../../components/Tabs'
import { AgentStatus, Badge, ConfigStatus, ErrorNote } from '../../components/ui'
import { timeAgo } from '../../lib/time'
import { AgentActions } from './AgentActions'
import { AgentActivity } from './AgentActivity'
import { AgentLogs } from './AgentLogs'
import { BridgeCollectors } from './BridgeCollectors'
import { AgentMetrics } from './AgentMetrics'
import { AgentTraces } from './AgentTraces'
import { PushConfig } from './PushConfig'
import { Breadcrumbs } from '../../components/Breadcrumbs'
import { Modal } from '../../components/Dialogs'
import { LabelChips, LabelForm } from '../../components/Labels'
import { LABEL_PREFIX } from '../../lib/labels'

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-4 border-b border-border px-4 py-2 last:border-b-0">
      <dt className="w-44 shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 break-all">{children}</dd>
    </div>
  )
}

/** The labels people have put on this collector, with a dialog to change them. */
function Labels({ agent, editable }: { agent: Agent; editable: boolean }) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const save = useMutation({
    mutationFn: (labels: Record<string, string>) => api.setAgentLabels(agent.instance_uid, labels),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['agents'] })
      setEditing(false)
    },
  })
  const none = Object.keys(agent.labels).length === 0
  return (
    <section className="card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
        <h2 className="font-medium">Labels</h2>
        {editable && (
          <button
            className="btn btn-sm"
            onClick={() => {
              save.reset()
              setEditing(true)
            }}
          >
            <Tag size={12} /> {none ? 'Add labels' : 'Edit labels'}
          </button>
        )}
      </div>
      <div className="px-4 py-3">
        {none ? (
          <p className="text-muted">
            None. Labels are your own name=value tags, kept here rather than in the collector's config. Use them to group collectors: a label
            <span className="font-mono text-xs"> owner=alice</span> can be picked as <span className="font-mono text-xs">{LABEL_PREFIX}owner</span> in groups, bulk
            pushes and fleet filters.
          </p>
        ) : (
          <>
            <LabelChips labels={agent.labels} />
            <p className="mt-2 text-xs text-muted">
              In groups, bulk pushes and fleet filters a label is picked as <span className="font-mono">{LABEL_PREFIX}name</span>.
            </p>
          </>
        )}
      </div>
      <Modal open={editing} onClose={() => setEditing(false)} size="lg" title="Labels" description="Your own name=value tags for this collector. What the collector reports about itself is not changed.">
        {editing && <LabelForm initial={agent.labels} pending={save.isPending} error={save.error} onCancel={() => setEditing(false)} onSubmit={(c) => save.mutate(c.set)} />}
      </Modal>
    </section>
  )
}

export function AgentDetail() {
  const { uid = '' } = useParams()
  const { canIn } = useAuth()
  const { data: a, error, isLoading } = useQuery({ queryKey: ['agents', uid], queryFn: () => api.agent(uid), refetchInterval: 30_000 })

  if (isLoading) return <p className="text-muted">Loading…</p>
  if (error || !a) return <ErrorNote error={error} />

  const isBridge = a.connector_type === 'k8s_bridge'

  return (
    <div className="space-y-4">
      <Breadcrumbs items={[{ label: 'Fleet', to: '/agents' }, { label: a.attributes['host.name'] ?? a.instance_uid }]} />
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">{a.attributes['host.name'] ?? a.instance_uid}</h1>
          <AgentStatus agent={a} />
        </div>
        <div className="flex items-center gap-2">
          <Link to={`/agents/compare?a=${a.instance_uid}`} className="btn">
            <GitCompareArrows size={14} /> Compare with…
          </Link>
          {canIn(a.project_id, 'operator') && !isBridge && <AgentActions agent={a} />}
        </div>
      </div>

      <Tabs
        label="Collector details"
        tabs={[
          // A bridge's page leads with the Kubernetes collectors it stands in for.
          ...(isBridge ? [{ value: 'kubernetes', label: 'Kubernetes collectors', content: <BridgeCollectors agent={a} /> }] : []),
          {
            value: 'overview',
            label: 'Overview',
            content: (
              <>
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="card">
                <h2 className="border-b border-border px-4 py-2 font-medium">Overview</h2>
                <dl>
                  <Row label="Instance UID">
                    <span className="font-mono text-xs">{a.instance_uid}</span>
                  </Row>
                  <Row label="Connector type">{a.connector_type}</Row>
                  <Row label="Connection">
                    {a.transport === 'http' ? (
                      <>
                        HTTP polling
                        <div className="text-xs text-muted">
                          This collector asks for changes instead of holding a connection open, so a config or a restart reaches it on its next poll rather
                          than at once.
                        </div>
                      </>
                    ) : (
                      'WebSocket'
                    )}
                  </Row>
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
                    // Labels have their own card below; here is only what the collector reports.
                    .filter(([k]) => !k.startsWith(LABEL_PREFIX))
                    .sort(([x], [y]) => x.localeCompare(y))
                    .map(([k, v]) => (
                      <Row key={k} label={k}>
                        {v}
                      </Row>
                    ))}
                </dl>
              </section>
            </div>

            <Labels agent={a} editable={canIn(a.project_id, 'operator')} />

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
                canIn(a.project_id, 'operator') && !isBridge && <PushConfig key={a.desired_config?.version_id ?? 'none'} agent={a} />
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
              </>
            ),
          },
          { value: 'activity', label: 'Activity', content: <AgentActivity uid={a.instance_uid} /> },
          // A bridge is not a collector and sends no telemetry of its own; the collectors behind it report inside the cluster.
          ...(isBridge
            ? []
            : [
                { value: 'metrics', label: 'Metrics', content: <AgentMetrics agent={a} /> },
                { value: 'logs', label: 'Logs', content: <AgentLogs agent={a} /> },
                { value: 'traces', label: 'Traces', content: <AgentTraces agent={a} /> },
              ]),
        ]}
      />
    </div>
  )
}
