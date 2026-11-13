import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type Agent, type BridgeCollector } from '../../api-client/client'
import { useAuth } from '../../auth/AuthProvider'
import { Modal } from '../../components/Dialogs'
import { Select } from '../../components/Select'
import { Badge, ErrorNote } from '../../components/ui'
import { confirmDialog } from '../../lib/dialog'

/** Choose a config version for one Kubernetes collector, in a dialog. */
function AssignConfig({ agent, collector, onClose }: { agent: Agent; collector: BridgeCollector; onClose: () => void }) {
  const qc = useQueryClient()
  const [configId, setConfigId] = useState(collector.assigned?.template_id ?? '')
  const [versionId, setVersionId] = useState('')
  const configs = useQuery({ queryKey: ['configs'], queryFn: api.configs })
  const detail = useQuery({ queryKey: ['configs', configId], queryFn: () => api.config(configId), enabled: configId !== '' })
  const versions = detail.data?.versions ?? []
  const chosen = versionId || versions[0]?.id || ''
  const assign = useMutation({
    mutationFn: () => api.setBridgeCollectorConfig(agent.instance_uid, collector.key, chosen),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['agents', agent.instance_uid] })
      onClose()
    },
  })
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">
        The bridge replaces this collector's pipeline config in the cluster and the operator rolls its pods. Replicas, image and other
        settings of the resource are left as they are.
      </p>
      <label className="block space-y-1">
        <span className="block text-xs text-muted">Config</span>
        <Select
          className="w-full"
          value={configId}
          placeholder="Select a config…"
          aria-label="Config"
          onChange={(v) => {
            setConfigId(v)
            setVersionId('')
          }}
          options={(configs.data?.configs ?? []).filter((c) => c.project_id === agent.project_id).map((c) => ({ value: c.id, label: c.name }))}
        />
      </label>
      <label className="block space-y-1">
        <span className="block text-xs text-muted">Version</span>
        <Select
          className="w-full"
          value={chosen}
          placeholder="No versions"
          aria-label="Version"
          disabled={versions.length === 0}
          onChange={setVersionId}
          options={versions.map((v) => ({ value: v.id, label: `v${v.version}`, hint: v.description || undefined }))}
        />
      </label>
      {assign.error && <p className="text-xs text-danger">{assign.error.message}</p>}
      <div className="flex justify-end gap-2">
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
        <button className="btn btn-primary" disabled={!chosen || assign.isPending} onClick={() => assign.mutate()}>
          Apply to collector
        </button>
      </div>
    </div>
  )
}

/** The OpenTelemetryCollector resources a Kubernetes OpAMP Bridge reports, and the config assigned to each. */
export function BridgeCollectors({ agent }: { agent: Agent }) {
  const qc = useQueryClient()
  const { canIn } = useAuth()
  const [assigning, setAssigning] = useState<BridgeCollector | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const { data, error } = useQuery({
    queryKey: ['agents', agent.instance_uid, 'collectors'],
    queryFn: () => api.bridgeCollectors(agent.instance_uid),
    refetchInterval: 10_000,
  })
  const unassign = useMutation({
    mutationFn: (key: string) => api.setBridgeCollectorConfig(agent.instance_uid, key, null),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agents', agent.instance_uid] }),
  })
  const mayChange = canIn(agent.project_id, 'operator')

  return (
    <>
      <p className="max-w-4xl text-xs text-muted">
        This agent is an OpAMP Bridge of the OpenTelemetry Operator. It stands in for the collectors below, which the operator runs in the
        cluster. A collector labelled <code className="font-mono">opentelemetry.io/opamp-managed</code> can be given a config from here;
        one labelled <code className="font-mono">opentelemetry.io/opamp-reporting</code> is shown only.
      </p>
      <p className="max-w-4xl text-xs text-muted">
        These collectors' own logs, metrics and traces are not shown in this console: they do not connect to it, only the bridge does. Read
        them in the cluster, for example with <code className="font-mono">kubectl logs</code> or from each pod's metrics endpoint.
      </p>
      {error ? (
        <ErrorNote error={error} />
      ) : data?.collectors.length === 0 ? (
        <p className="card p-4 text-muted">
          The bridge reports no collectors. Label an OpenTelemetryCollector resource with{' '}
          <code className="font-mono text-xs">opentelemetry.io/opamp-managed: "true"</code> and it appears here within about a minute.
        </p>
      ) : (
        <div className="card overflow-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Collector</th>
                <th>Health</th>
                <th>Runs as</th>
                <th>Config from this console</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data?.collectors.map((c) => (
                <tr key={c.key}>
                  <td className="align-top">
                    <button className="text-left font-mono text-xs font-medium hover:underline" aria-expanded={open === c.key} onClick={() => setOpen(open === c.key ? null : c.key)}>
                      {c.name}
                    </button>
                    <div className="text-xs text-muted">namespace {c.namespace}</div>
                    {open === c.key && (
                      <pre className="mt-2 max-h-96 overflow-auto rounded bg-panel-2 p-2 font-mono text-xs leading-5">{c.config || 'No config reported.'}</pre>
                    )}
                  </td>
                  <td className="align-top">
                    {c.healthy === null ? <Badge tone="neutral">Unknown</Badge> : c.healthy ? <Badge tone="success">Healthy</Badge> : <Badge tone="danger">Unhealthy</Badge>}
                    <ul className="mt-1 space-y-0.5 text-xs text-muted">
                      {c.pods.map((p) => (
                        <li key={p.name} className={p.healthy ? undefined : 'text-danger'}>
                          {p.name.split('/').pop()} · {p.status}
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="align-top">
                    <span className="capitalize">{c.mode || 'deployment'}</span>
                    {c.replicas !== null && <span className="text-muted"> · {c.replicas} {c.replicas === 1 ? 'replica' : 'replicas'}</span>}
                  </td>
                  <td className="align-top">
                    {!c.managed ? (
                      <span className="text-muted">Reported only</span>
                    ) : c.assigned ? (
                      <div className="space-y-1">
                        <Link to={`/configs/${c.assigned.template_id}`} className="text-accent hover:underline">
                          {c.assigned.template_name} v{c.assigned.version}
                        </Link>{' '}
                        {c.in_sync ? <Badge tone="success">Applied</Badge> : <Badge tone="warning">Not applied yet</Badge>}
                        <div className="text-xs text-muted">set by {c.assigned.set_by}</div>
                      </div>
                    ) : (
                      <span className="text-muted">None; runs what is in the cluster</span>
                    )}
                  </td>
                  <td className="space-x-2 text-right align-top whitespace-nowrap">
                    <button className="btn btn-sm" onClick={() => setOpen(open === c.key ? null : c.key)}>
                      {open === c.key ? 'Hide config' : 'View config'}
                    </button>
                    {c.managed && mayChange && (
                      <button className="btn btn-sm" onClick={() => setAssigning(c)}>
                        {c.assigned ? 'Change config' : 'Set config'}
                      </button>
                    )}
                    {c.assigned && mayChange && (
                      <button
                        className="btn btn-sm"
                        disabled={unassign.isPending}
                        onClick={() =>
                          void confirmDialog({
                            title: `Stop managing the config of "${c.name}" from here?`,
                            body: 'The collector keeps the config it is running. Changes made in the cluster are no longer overwritten.',
                            action: 'Stop managing',
                          }).then((ok) => ok && unassign.mutate(c.key))
                        }
                      >
                        Release
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {unassign.error && <p className="p-3 text-xs text-danger">{unassign.error.message}</p>}
        </div>
      )}
      <Modal open={assigning !== null} onClose={() => setAssigning(null)} title={assigning ? `Config for "${assigning.name}"` : ''}>
        {assigning && <AssignConfig key={assigning.key} agent={agent} collector={assigning} onClose={() => setAssigning(null)} />}
      </Modal>
    </>
  )
}
