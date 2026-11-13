import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { ProjectSelect } from '../../components/ProjectSelect'
import { Link, useNavigate } from 'react-router-dom'
import { api, ApiError } from '../../api-client/client'
import { IssueList, YamlEditor } from './parts'

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

  const create = useMutation({
    mutationFn: () => api.createConfig(name.trim(), description.trim(), body, project ?? null),
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
      <Link to="/configs" className="inline-flex items-center gap-1 text-xs text-muted hover:text-fg">
        <ArrowLeft size={13} /> Configs
      </Link>
      <h1 className="text-lg font-semibold">New config</h1>
      <div className="flex flex-wrap gap-3">
        <label className="space-y-1">
          <span className="block text-xs text-muted">Name</span>
          <input className="input w-64" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. prod-gateway" autoFocus />
        </label>
        <ProjectSelect value={project} onChange={setProject} />
        <label className="flex-1 space-y-1">
          <span className="block text-xs text-muted">Description</span>
          <input className="input w-full" value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
      </div>
      <div className="card">
        <YamlEditor value={body} onChange={setBody} />
      </div>
      {err instanceof ApiError && err.issues.length > 0 ? <IssueList issues={err.issues} /> : err && <p className="text-xs text-danger">{err.message}</p>}
      <button className="btn btn-primary" disabled={!name.trim() || create.isPending}>
        Create config
      </button>
    </form>
  )
}
