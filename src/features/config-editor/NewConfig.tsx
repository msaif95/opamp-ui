import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { ProjectSelect } from '../../components/ProjectSelect'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api, ApiError } from '../../api-client/client'
import { Select } from '../../components/Select'
import { OverridesEditor } from './Derived'
import { useMerged } from './useMerged'
import { IssueList, YamlEditor } from './parts'
import { Breadcrumbs } from '../../components/Breadcrumbs'

const STARTER = `receivers:
  otlp:
    protocols:
      grpc:
      http:
processors:
  batch:
exporters:
  debug:
service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [debug]
`

export function NewConfig() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [body, setBody] = useState(STARTER)
  const [project, setProject] = useState<string | null | undefined>(undefined)
  // A derived config takes another config as its base and holds only what differs. ?base=<id> starts in that mode.
  const [params] = useSearchParams()
  const [baseId, setBaseId] = useState(() => params.get('base') ?? '')
  const [deriving, setDeriving] = useState(baseId !== '')
  const [overrides, setOverrides] = useState('')
  const configs = useQuery({ queryKey: ['configs'], queryFn: api.configs })
  const base = configs.data?.configs.find((c) => c.id === baseId)
  // A derived config lives in its base's project.
  const inProject = deriving && base ? base.project_id : (project ?? null)
  // Only ordinary configs of the chosen project can be a base.
  const bases = (configs.data?.configs ?? []).filter((c) => c.base === null && (project === undefined || c.project_id === project || c.id === baseId))
  const merged = useMerged(base?.id, overrides, deriving)

  const create = useMutation({
    mutationFn: () =>
      deriving ? api.createDerivedConfig(name.trim(), description.trim(), baseId, overrides, inProject) : api.createConfig(name.trim(), description.trim(), body, project ?? null),
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: ['configs'] })
      navigate(`/configs/${res.config.id}`)
    },
  })
  const submit = (e: FormEvent) => {
    e.preventDefault()
    create.mutate()
  }
  const err = create.error

  return (
    <form onSubmit={submit} className="space-y-4">
      <Breadcrumbs items={[{ label: 'Configs', to: '/configs' }, { label: 'New config' }]} />
      <h1 className="text-lg font-semibold">New config</h1>
      <div className="flex flex-wrap gap-3">
        <label className="space-y-1">
          <span className="block text-xs text-muted">Name</span>
          <input className="input w-64" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. prod-gateway" autoFocus />
        </label>
        {!(deriving && base) && <ProjectSelect value={project} onChange={setProject} />}
        <label className="flex-1 space-y-1">
          <span className="block text-xs text-muted">Description</span>
          <input className="input w-full" value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="seg" role="group" aria-label="How to write it">
          <button type="button" className={deriving ? '' : 'active'} onClick={() => setDeriving(false)}>
            Write the whole config
          </button>
          <button type="button" className={deriving ? 'active' : ''} onClick={() => setDeriving(true)}>
            Derive from a base config
          </button>
        </div>
        {deriving && (
          <Select
            className="w-72"
            aria-label="Base config"
            placeholder="Choose the base config…"
            value={baseId}
            onChange={setBaseId}
            options={bases.map((c) => ({ value: c.id, label: c.name, hint: c.description || `v${c.latest_version}` }))}
          />
        )}
      </div>
      {deriving && (
        <p className="max-w-4xl text-xs text-muted">
          A derived config is its base with a few differences, for example one per environment. It is built from the base as it is now; when the base later
          changes you choose when to update this config from it.
        </p>
      )}
      <div className="card">
        {!deriving ? (
          <YamlEditor value={body} onChange={setBody} project={project ?? null} />
        ) : base ? (
          <OverridesEditor baseName={base.name} overrides={overrides} onChange={setOverrides} project={inProject} merged={merged} result={merged.data?.body ?? ''} />
        ) : (
          <p className="p-4 text-muted">{bases.length === 0 && configs.data ? 'There is no config here to derive from yet. Create an ordinary config first.' : 'Choose the base config above.'}</p>
        )}
      </div>
      {err instanceof ApiError && err.issues.length > 0 ? <IssueList issues={err.issues} /> : err && <p className="text-xs text-danger">{err.message}</p>}
      <button className="btn btn-primary" disabled={!name.trim() || (deriving && !base) || create.isPending}>
        Create config
      </button>
    </form>
  )
}
