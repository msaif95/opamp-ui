import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, type Selector } from '../../api-client/client'
import { ErrorNote } from '../../components/ui'

/** Attributes operators usually target by, shown first when agents report them. */
const PREFERRED = ['env', 'deployment.environment', 'region', 'cloud.region', 'cloud.provider', 'cloud', 'dc', 'datacenter', 'team']

export function NewRollout() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [configId, setConfigId] = useState('')
  const [versionId, setVersionId] = useState('')
  const [selector, setSelector] = useState<Selector>({})
  const [allAgents, setAllAgents] = useState(false)
  const [batchSize, setBatchSize] = useState('100')
  const [maxFailurePct, setMaxFailurePct] = useState('2')

  const configs = useQuery({ queryKey: ['configs'], queryFn: api.configs })
  const detail = useQuery({ queryKey: ['configs', configId], queryFn: () => api.config(configId), enabled: configId !== '' })
  const versions = detail.data?.versions ?? []
  const chosenVersion = versionId || versions[0]?.id || ''

  const facets = useQuery({ queryKey: ['agents', 'facets'], queryFn: api.facets })
  const rank = (k: string) => (PREFERRED.includes(k) ? PREFERRED.indexOf(k) : PREFERRED.length)
  const sortedFacets = [...(facets.data?.facets ?? [])].sort((a, b) => rank(a.key) - rank(b.key) || a.key.localeCompare(b.key))

  const hasSelector = Object.keys(selector).length > 0
  const targeted = hasSelector || allAgents
  const preview = useQuery({
    queryKey: ['agents', 'preview', selector],
    queryFn: () => api.previewRollout(selector),
    enabled: targeted,
    placeholderData: keepPreviousData,
  })

  const toggle = (key: string, value: string) => {
    const current = selector[key] ?? []
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
    const rest = Object.fromEntries(Object.entries(selector).filter(([k]) => k !== key))
    setSelector(next.length > 0 ? { ...rest, [key]: next } : rest)
    setAllAgents(false)
  }

  const batch = Number(batchSize)
  const pct = Number(maxFailurePct)
  const paramsValid = Number.isInteger(batch) && batch >= 1 && batch <= 5000 && pct >= 0 && pct <= 100
  const matched = preview.data?.total ?? 0

  const create = useMutation({
    mutationFn: () =>
      api.createRollout({ config_version_id: chosenVersion, selector, all_agents: allAgents, batch_size: batch, max_failure_pct: pct }),
    onSuccess: async (r) => {
      await qc.invalidateQueries({ queryKey: ['rollouts'] })
      navigate(`/rollouts/${r.id}`)
    },
  })
  const start = () => {
    const name = configs.data?.configs.find((c) => c.id === configId)?.name
    const version = versions.find((v) => v.id === chosenVersion)?.version
    if (confirm(`Push ${name} v${version} to ${matched.toLocaleString()} agents in batches of ${batch}?`)) create.mutate()
  }

  return (
    <div className="max-w-4xl space-y-4">
      <Link to="/rollouts" className="inline-flex items-center gap-1 text-xs text-muted hover:text-fg">
        <ArrowLeft size={13} /> Bulk push
      </Link>
      <h1 className="text-lg font-semibold">New bulk push</h1>

      <section className="card space-y-3 p-4">
        <h2 className="font-medium">1. Config</h2>
        <div className="flex flex-wrap gap-2">
          <select
            className="input w-64"
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
          <select className="input w-72" value={chosenVersion} onChange={(e) => setVersionId(e.target.value)} disabled={versions.length === 0} aria-label="Version">
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                v{v.version}
                {v.description ? ` – ${v.description}` : ''}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="card space-y-3 p-4">
        <div>
          <h2 className="font-medium">2. Target agents</h2>
          <p className="text-xs text-muted">
            Pick values to narrow the target. Values of the same attribute are combined with OR; different attributes with AND.
          </p>
        </div>
        {facets.error && <ErrorNote error={facets.error} />}
        {sortedFacets.map((f) => (
          <div key={f.key} className="flex gap-3">
            <div className="w-40 shrink-0 pt-1 font-mono text-xs text-muted">{f.key}</div>
            <div className="flex flex-wrap gap-1.5">
              {f.values.map((v) => {
                const on = selector[f.key]?.includes(v.value) ?? false
                return (
                  <button
                    key={v.value}
                    type="button"
                    aria-pressed={on}
                    className={clsx('chip', on ? 'border-accent bg-accent-soft text-accent' : 'hover:bg-hover')}
                    onClick={() => toggle(f.key, v.value)}
                  >
                    {v.value || '(empty)'} <span className="text-faint">{v.count.toLocaleString()}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
        <label className="flex items-center gap-2 border-t border-border pt-3 text-xs">
          <input
            type="checkbox"
            checked={allAgents}
            onChange={(e) => {
              setAllAgents(e.target.checked)
              if (e.target.checked) setSelector({})
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
        <div className="flex flex-wrap gap-4">
          <label className="space-y-1">
            <span className="block text-xs text-muted">Agents per batch</span>
            <input className="input w-40" type="number" min={1} max={5000} value={batchSize} onChange={(e) => setBatchSize(e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="block text-xs text-muted">Pause if more than this % of a batch fails</span>
            <input className="input w-40" type="number" min={0} max={100} step={0.5} value={maxFailurePct} onChange={(e) => setMaxFailurePct(e.target.value)} />
          </label>
        </div>
        <p className="text-xs text-muted">
          Agents are pushed in random order, one batch at a time. The next batch starts only when every agent in the current one has applied
          or failed.
          {paramsValid && matched > 0 && ` This push needs ${Math.ceil(matched / batch).toLocaleString()} batches.`}
        </p>
      </section>

      {create.error && <p className="text-xs text-danger">{create.error.message}</p>}
      <button className="btn btn-primary" disabled={!chosenVersion || !targeted || matched === 0 || !paramsValid || create.isPending} onClick={start}>
        Start bulk push
      </button>
    </div>
  )
}
