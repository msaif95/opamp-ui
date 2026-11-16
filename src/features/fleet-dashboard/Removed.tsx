import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api-client/client'
import { Breadcrumbs } from '../../components/Breadcrumbs'
import { ProjectName } from '../../components/ProjectSelect'
import { Badge, ErrorNote } from '../../components/ui'
import { timeAgo } from '../../lib/time'
import { KINDS } from '../agent-detail/eventKinds'

const when = (at: string) => new Date(at).toLocaleString()

/**
 * The fleet page's "Removed" view: the records kept of collectors removed from the fleet. `search` matches the
 * host name, UID, any attribute value and who removed it; `project` is a project ID, 'none' or '' for all.
 */
export function RemovedCollectors({ search, project, showProject }: { search: string; project: string; showProject: boolean }) {
  const navigate = useNavigate()
  const removed = useQuery({ queryKey: ['agents', 'deleted'], queryFn: api.deletedAgents })
  const needle = search.toLowerCase()
  const rows = (removed.data?.agents ?? []).filter(
    (d) =>
      (project === '' || (d.project_id ?? 'none') === project) &&
      (needle === '' || [d.host_name, d.instance_uid, d.deleted_by, ...Object.values(d.attributes)].some((v) => v.toLowerCase().includes(needle))),
  )
  if (removed.error) return <ErrorNote error={removed.error} />
  return (
    <>
      <div className="card overflow-auto">
        <table className="table dense">
          <thead>
            <tr>
              <th>Host</th>
              {showProject && <th>Project</th>}
              <th>Service</th>
              <th>Version</th>
              <th>Env</th>
              <th>Region</th>
              <th>Last seen</th>
              <th>Removed by</th>
              <th>Removed</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id} className="cursor-pointer" onClick={() => navigate(`/agents/removed/${d.id}`)}>
                <td className="font-mono text-xs">
                  <Link to={`/agents/removed/${d.id}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                    {d.host_name || d.instance_uid}
                  </Link>
                </td>
                {showProject && (
                  <td>
                    <ProjectName id={d.project_id} />
                  </td>
                )}
                <td>{d.attributes['service.name'] ?? '–'}</td>
                <td>{d.agent_version ?? '–'}</td>
                <td>{d.attributes['env'] ?? '–'}</td>
                <td>{d.attributes['region'] ?? '–'}</td>
                <td className="text-muted">{when(d.last_seen)}</td>
                <td>{d.deleted_by}</td>
                <td title={when(d.deleted_at)}>{timeAgo(d.deleted_at)}</td>
              </tr>
            ))}
            {removed.data && rows.length === 0 && (
              <tr>
                <td colSpan={9} className="py-8 text-center text-muted">
                  {removed.data.agents.length === 0 ? 'No collector has been removed.' : 'No removed collector matches these filters.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">
        {rows.length.toLocaleString()} removed {rows.length === 1 ? 'collector' : 'collectors'}. A record is kept of each with its history; one that
        connected again is in the fleet as a new collector.
      </p>
    </>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-4 border-b border-border px-4 py-2 last:border-b-0">
      <dt className="w-44 shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 break-all">{children}</dd>
    </div>
  )
}

/** One removed collector: who removed it and when, what it was, and the history kept with it. */
export function RemovedCollector() {
  const { id = '' } = useParams()
  const { data: d, error, isLoading } = useQuery({ queryKey: ['agents', 'deleted', id], queryFn: () => api.deletedAgent(id) })
  if (isLoading) return <p className="text-muted">Loading…</p>
  if (error || !d) return <ErrorNote error={error} />
  const name = d.host_name || d.instance_uid
  const attributes = Object.entries(d.attributes).sort(([a], [b]) => a.localeCompare(b))
  return (
    <div className="space-y-4">
      <Breadcrumbs items={[{ label: 'Fleet', to: '/agents' }, { label: 'Removed', to: '/agents?view=removed' }, { label: name }]} />
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold">{name}</h1>
        <Badge tone="neutral">Removed</Badge>
      </div>
      <p className="card border-warning p-3 text-xs">
        Removed from the fleet by <span className="font-medium">{d.deleted_by}</span> on {when(d.deleted_at)} ({timeAgo(d.deleted_at)}). This is the
        record kept of it; it can no longer be targeted, counted or sent configs.
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card self-start">
          <h2 className="border-b border-border px-4 py-2 font-medium">Removal</h2>
          <dl>
            <Row label="Removed by">{d.deleted_by}</Row>
            <Row label="Removed at">
              {when(d.deleted_at)} <span className="text-xs text-muted">({timeAgo(d.deleted_at)})</span>
            </Row>
            <Row label="Last seen">
              {when(d.last_seen)} <span className="text-xs text-muted">({timeAgo(d.last_seen)})</span>
            </Row>
            <Row label="First seen">{when(d.first_seen)}</Row>
          </dl>
        </section>
        <section className="card self-start">
          <h2 className="border-b border-border px-4 py-2 font-medium">Collector</h2>
          <dl>
            <Row label="Instance UID">
              <span className="font-mono text-xs">{d.instance_uid}</span>
            </Row>
            <Row label="Project">
              <ProjectName id={d.project_id} />
            </Row>
            <Row label="Collector version">{d.agent_version ?? '–'}</Row>
            <Row label="Connector">{d.connector_type === 'k8s_bridge' ? 'Kubernetes bridge' : d.connector_type}</Row>
            <Row label="Sign-in">{d.auth_mode === 'mtls' ? 'Client certificate' : 'API key'}</Row>
          </dl>
        </section>
      </div>

      <section className="card">
        <h2 className="border-b border-border px-4 py-2 font-medium">Attributes</h2>
        {attributes.length === 0 ? (
          <p className="p-4 text-muted">It reported no attributes.</p>
        ) : (
          <dl>
            {attributes.map(([k, v]) => (
              <Row key={k} label={k}>
                {v}
              </Row>
            ))}
          </dl>
        )}
      </section>

      <section className="card overflow-auto">
        <div className="border-b border-border px-4 py-2">
          <h2 className="font-medium">History</h2>
          <p className="text-xs text-muted">What was on record for this collector when it was removed, newest first.</p>
        </div>
        {d.history.length === 0 ? (
          <p className="p-4 text-muted">No history was on record.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th className="w-56">When</th>
                <th className="w-44">Event</th>
                <th>What happened</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="whitespace-nowrap">{when(d.deleted_at)}</td>
                <td>
                  <Badge tone="warning">Removed</Badge>
                </td>
                <td>Removed from the fleet by {d.deleted_by}.</td>
              </tr>
              {d.history.toReversed().map((e, n) => {
                const k = KINDS[e.kind]
                return (
                  <tr key={n}>
                    <td className="whitespace-nowrap">{when(e.at)}</td>
                    <td>
                      <Badge tone={k?.tone ?? 'neutral'}>{k?.label ?? e.kind}</Badge>
                    </td>
                    <td className="break-words">{k ? k.text(e.detail) : JSON.stringify(e.detail)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="card">
        <h2 className="border-b border-border px-4 py-2 font-medium">Last reported config</h2>
        {d.effective_config ? (
          <pre className="max-h-[28rem] overflow-auto p-4 font-mono text-xs leading-5">{d.effective_config}</pre>
        ) : (
          <p className="p-4 text-muted">It never reported the config it was running.</p>
        )}
      </section>
    </div>
  )
}
