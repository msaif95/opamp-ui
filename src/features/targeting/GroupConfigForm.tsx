import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type Group } from '../../api-client/client'
import { confirmDialog } from '../../lib/dialog'
import { Select } from '../../components/Select'

/** Makes a group own a config: rolls it out to current members and hands it to agents that join later. */
export function GroupConfigForm({ group, onDone }: { group: Group; onDone: () => void }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [configId, setConfigId] = useState(group.config?.template_id ?? '')
  const [versionId, setVersionId] = useState('')
  const [batchSize, setBatchSize] = useState('100')
  const [maxFailurePct, setMaxFailurePct] = useState('2')

  const configs = useQuery({ queryKey: ['configs'], queryFn: api.configs })
  const detail = useQuery({ queryKey: ['configs', configId], queryFn: () => api.config(configId), enabled: configId !== '' })
  const versions = detail.data?.versions ?? []
  const chosen = versionId || versions[0]?.id || ''
  const batch = Number(batchSize)
  const pct = Number(maxFailurePct)
  const valid = chosen !== '' && Number.isInteger(batch) && batch >= 1 && batch <= 5000 && maxFailurePct !== '' && pct >= 0 && pct <= 100

  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ['groups'] }), qc.invalidateQueries({ queryKey: ['rollouts'] })])
  const save = useMutation({
    mutationFn: () => api.setGroupConfig(group.id, chosen, batch, pct),
    onSuccess: async (res) => {
      await refresh()
      onDone()
      if (res.rollout) navigate(`/rollouts/${res.rollout.id}`)
    },
  })
  const clear = useMutation({
    mutationFn: () => api.clearGroupConfig(group.id),
    onSuccess: async () => {
      await refresh()
      onDone()
    },
  })
  const error = save.error ?? clear.error

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1">
          <span className="block text-xs text-muted">Config</span>
          <Select
        className="w-56"
        value={configId}
        placeholder="Select a config…"
        aria-label="Config"
        onChange={(v) => {
          setConfigId(v)
          setVersionId('')
        }}
        options={(configs.data?.configs ?? []).filter((c) => c.project_id === group.project_id).map((c) => ({ value: c.id, label: c.name }))}
      />
        </label>
        <label className="space-y-1">
          <span className="block text-xs text-muted">Version</span>
          <Select
        className="w-56"
        value={chosen}
        placeholder="No versions"
        aria-label="Version"
        disabled={versions.length === 0}
        onChange={setVersionId}
        options={versions.map((v) => ({ value: v.id, label: `v${v.version}`, hint: v.description || undefined }))}
      />
        </label>
        <label className="space-y-1">
          <span className="block text-xs text-muted">Agents per batch</span>
          <input className="input w-32" type="number" min={1} max={5000} value={batchSize} onChange={(e) => setBatchSize(e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="block text-xs text-muted">Pause above % failed</span>
          <input className="input w-32" type="number" min={0} max={100} step={0.5} value={maxFailurePct} onChange={(e) => setMaxFailurePct(e.target.value)} />
        </label>
      </div>
      {error && <p className="text-xs text-danger">{error.message}</p>}
      <div className="flex justify-end gap-2">
        {group.config && (
          <button
            className="btn mr-auto"
            disabled={clear.isPending}
            onClick={() => {
              void confirmDialog('Stop this group handing out a config? Agents keep the config they already have.').then((ok) => ok && clear.mutate())
            }}
          >
            Remove group config
          </button>
        )}
        <button className="btn" onClick={onDone}>
          Cancel
        </button>
        <button
          className="btn btn-primary"
          disabled={!valid || save.isPending}
          onClick={() => {
            void confirmDialog({
              title: `Push this config to "${group.name}"?`,
              body: `It goes to the group's ${group.members.toLocaleString()} agents in batches and becomes the group's config.`,
              action: 'Set and push',
            }).then((ok) => ok && save.mutate())
          }}
        >
          Set and push
        </button>
      </div>
    </div>
  )
}
