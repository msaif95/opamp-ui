import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type Selector } from '../../api-client/client'
import { useAuth } from '../../auth/AuthProvider'
import { ProjectSelect } from '../../components/ProjectSelect'
import { SelectorPicker } from '../../components/SelectorPicker'
import { parseSteps } from '../../lib/steps'
import { confirmDialog } from '../../lib/dialog'
import { Select } from '../../components/Select'
import { Breadcrumbs } from '../../components/Breadcrumbs'

export function NewRollout() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [configId, setConfigId] = useState('')
  const [versionId, setVersionId] = useState('')
  const [selector, setSelector] = useState<Selector>({})
  const [groupId, setGroupId] = useState('')
  const [allAgents, setAllAgents] = useState(false)
  const [strategy, setStrategy] = useState<'batches' | 'canary'>('batches')
  const [batchSize, setBatchSize] = useState('100')
  const [stepsText, setStepsText] = useState('1, 10, 50, 100')
  const [maxFailurePct, setMaxFailurePct] = useState('2')
  const [autoRollback, setAutoRollback] = useState(false)
  const [manualApproval, setManualApproval] = useState(false)
  const [chosenProject, setChosenProject] = useState<string | null | undefined>(undefined)
  const { user } = useAuth()

  const configs = useQuery({ queryKey: ['configs'], queryFn: api.configs })
  const detail = useQuery({ queryKey: ['configs', configId], queryFn: () => api.config(configId), enabled: configId !== '' })
  const versions = detail.data?.versions ?? []
  const chosenVersion = versionId || versions[0]?.id || ''
  const groups = useQuery({ queryKey: ['groups'], queryFn: api.groups })
  // A push stays inside one project: a saved group brings its own, otherwise it is the chosen one.
  const project = groupId ? (groups.data?.groups.find((g) => g.id === groupId)?.project_id ?? null) : (chosenProject ?? null)
  const sameProject = <T extends { project_id: string | null }>(list: T[] | undefined) =>
    (list ?? []).filter((x) => x.project_id === project || user?.admin)

  const hasSelector = Object.keys(selector).length > 0
  const targeted = hasSelector || allAgents
  const preview = useQuery({
    queryKey: ['agents', 'preview', selector, project],
    queryFn: () => api.previewRollout(selector, project),
    enabled: targeted,
    placeholderData: keepPreviousData,
  })

  const pickGroup = (id: string) => {
    setGroupId(id)
    setAllAgents(false)
    setSelector(groups.data?.groups.find((g) => g.id === id)?.selector ?? {})
  }

  const batch = Number(batchSize)
  const pct = Number(maxFailurePct)
  const steps = parseSteps(stepsText)
  const paceValid = strategy === 'canary' ? steps !== null : Number.isInteger(batch) && batch >= 1 && batch <= 5000
  const paramsValid = paceValid && maxFailurePct !== '' && pct >= 0 && pct <= 100
  const matched = preview.data?.total ?? 0
  const pace =
    strategy === 'canary' ? `in steps of ${steps?.join('% → ')}%` : `in batches of ${batch}`

  const create = useMutation({
    mutationFn: () =>
      api.createRollout({
        config_version_id: chosenVersion,
        selector,
        all_agents: allAgents,
        group_id: groupId || null,
        batch_size: strategy === 'batches' ? batch : 100,
        canary_steps_pct: strategy === 'canary' ? steps : null,
        max_failure_pct: pct,
        auto_rollback: autoRollback,
        manual_approval: manualApproval,
        project_id: project,
      }),
    onSuccess: async (r) => {
      await qc.invalidateQueries({ queryKey: ['rollouts'] })
      navigate(`/rollouts/${r.id}`)
    },
  })
  const start = () => {
    const name = configs.data?.configs.find((c) => c.id === configId)?.name
    const version = versions.find((v) => v.id === chosenVersion)?.version
    void confirmDialog(`Push ${name} v${version} to ${matched.toLocaleString()} agents ${pace}?`).then((ok) => ok && create.mutate())
  }

  return (
    <div className="max-w-4xl space-y-4">
      <Breadcrumbs items={[{ label: 'Bulk push', to: '/rollouts' }, { label: 'New bulk push' }]} />
      <h1 className="text-lg font-semibold">New bulk push</h1>

      <section className="card space-y-3 p-4">
        <h2 className="font-medium">1. Config</h2>
        <div className="flex flex-wrap items-end gap-2">
          {!groupId && (
            <ProjectSelect
              value={chosenProject}
              onChange={(p) => {
                // Collectors, attributes and configs all differ per project.
                setChosenProject(p)
                setSelector({})
                setAllAgents(false)
                setConfigId('')
                setVersionId('')
              }}
            />
          )}
          <Select
        className="w-64"
        value={configId}
        placeholder="Select a config…"
        aria-label="Config"
        onChange={(v) => {
          setConfigId(v)
          setVersionId('')
        }}
        options={sameProject(configs.data?.configs).map((c) => ({ value: c.id, label: c.name }))}
      />
          <Select
        className="w-72"
        value={chosenVersion}
        placeholder="No versions"
        aria-label="Version"
        disabled={versions.length === 0}
        onChange={setVersionId}
        options={versions.map((v) => ({ value: v.id, label: `v${v.version}`, hint: v.description || undefined }))}
      />
        </div>
      </section>

      <section className="card space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-medium">2. Target agents</h2>
            <p className="text-xs text-muted">
              Use a saved group, or pick values. Values of the same attribute are combined with OR; different attributes with AND.
            </p>
          </div>
          <Select
            className="w-56"
            value={groupId}
            aria-label="Saved group"
            onChange={pickGroup}
            options={[
              { value: '', label: 'No saved group' },
              ...(groups.data?.groups ?? []).map((g) => ({ value: g.id, label: g.name, hint: `${g.members.toLocaleString()} agents` })),
            ]}
          />
        </div>
        <SelectorPicker
          project={project}
          selector={selector}
          onChange={(s) => {
            // Editing the target by hand means it is no longer the saved group.
            setSelector(s)
            setGroupId('')
            setAllAgents(false)
          }}
        />
        <label className="flex items-center gap-2 border-t border-border pt-3 text-xs">
          <input
            type="checkbox"
            checked={allAgents}
            onChange={(e) => {
              setAllAgents(e.target.checked)
              if (e.target.checked) {
                setSelector({})
                setGroupId('')
              }
            }}
          />
          Target every agent in the fleet
        </label>
        <p className={clsx('text-sm', targeted ? 'text-fg' : 'text-muted')}>
          {!targeted
            ? 'No target selected yet.'
            : preview.data
              ? `Matches ${matched.toLocaleString()} agents: ${preview.data.connected.toLocaleString()} connected, ${(preview.data.total - preview.data.eligible).toLocaleString()} do not accept remote config and will be skipped.`
              : 'Counting…'}
        </p>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="font-medium">3. Pace and safety</h2>
        <div className="seg">
          <button type="button" className={strategy === 'batches' ? 'active' : ''} onClick={() => setStrategy('batches')}>
            Fixed batches
          </button>
          <button type="button" className={strategy === 'canary' ? 'active' : ''} onClick={() => setStrategy('canary')}>
            Canary steps
          </button>
        </div>
        <div className="flex flex-wrap gap-4">
          {strategy === 'batches' ? (
            <label className="space-y-1">
              <span className="block text-xs text-muted">Agents per batch</span>
              <input className="input w-40" type="number" min={1} max={5000} value={batchSize} onChange={(e) => setBatchSize(e.target.value)} />
            </label>
          ) : (
            <label className="space-y-1">
              <span className="block text-xs text-muted">Cumulative % of the target at each step</span>
              <input
                className={clsx('input w-56', steps === null && 'border-danger')}
                value={stepsText}
                onChange={(e) => setStepsText(e.target.value)}
                aria-label="Canary steps"
              />
            </label>
          )}
          <label className="space-y-1">
            <span className="block text-xs text-muted">Stop if more than this % of a batch fails</span>
            <input className="input w-40" type="number" min={0} max={100} step={0.5} value={maxFailurePct} onChange={(e) => setMaxFailurePct(e.target.value)} />
          </label>
        </div>
        {strategy === 'canary' && steps === null && (
          <p className="text-xs text-danger">Enter increasing whole percentages ending at 100, for example 1, 10, 50, 100.</p>
        )}
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={autoRollback} onChange={(e) => setAutoRollback(e.target.checked)} />
          When that limit is exceeded, roll back automatically instead of pausing
        </label>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={manualApproval} onChange={(e) => setManualApproval(e.target.checked)} />
          Wait for approval after every batch before starting the next
        </label>
        <p className="text-xs text-muted">
          Agents are pushed in random order, one batch at a time. The next batch starts only when every agent in the current one has applied
          or failed.
          {paramsValid && matched > 0 && strategy === 'batches' && ` This push needs ${Math.ceil(matched / batch).toLocaleString()} batches.`}
          {paramsValid &&
            matched > 0 &&
            strategy === 'canary' &&
            ` Steps reach ${steps!.map((s) => Math.ceil((matched * s) / 100).toLocaleString()).join(', then ')} agents.`}
        </p>
      </section>

      {create.error && <p className="text-xs text-danger">{create.error.message}</p>}
      <button className="btn btn-primary" disabled={!chosenVersion || !targeted || matched === 0 || !paramsValid || create.isPending} onClick={start}>
        Start bulk push
      </button>
    </div>
  )
}
