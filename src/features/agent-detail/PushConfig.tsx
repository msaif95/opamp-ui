import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api, type Agent } from '../../api-client/client'

/** Lets an operator assign a config version to one agent; the backend pushes it immediately. */
export function PushConfig({ agent }: { agent: Agent }) {
  const qc = useQueryClient()
  const [configId, setConfigId] = useState(agent.desired_config?.template_id ?? '')
  const [versionId, setVersionId] = useState('')

  const configs = useQuery({ queryKey: ['configs'], queryFn: api.configs })
  const detail = useQuery({ queryKey: ['configs', configId], queryFn: () => api.config(configId), enabled: configId !== '' })
  const versions = detail.data?.versions ?? []
  const chosen = versionId || versions[0]?.id || ''

  const push = useMutation({
    mutationFn: () => api.assignConfig(agent.instance_uid, chosen),
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: ['agents'] }), qc.invalidateQueries({ queryKey: ['configs'] })]),
  })

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3">
      <select
        className="input w-56"
        value={configId}
        onChange={(e) => {
          setConfigId(e.target.value)
          setVersionId('')
        }}
        aria-label="Config"
      >
        <option value="">Select a config…</option>
        {configs.data?.configs.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <select className="input w-56" value={chosen} onChange={(e) => setVersionId(e.target.value)} disabled={versions.length === 0} aria-label="Version">
        {versions.map((v) => (
          <option key={v.id} value={v.id}>
            v{v.version}
            {v.description ? ` – ${v.description}` : ''}
          </option>
        ))}
      </select>
      <button
        className="btn btn-primary"
        disabled={!chosen || push.isPending || chosen === agent.desired_config?.version_id}
        onClick={() => push.mutate()}
      >
        Push config
      </button>
      {push.error && <span className="text-xs text-danger">{push.error.message}</span>}
    </div>
  )
}
