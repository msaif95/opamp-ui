import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { ArrowLeftRight } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, ApiError, type Issue } from '../../api-client/client'
import { useAuth } from '../../auth/AuthProvider'
import { Select } from '../../components/Select'
import { ErrorNote } from '../../components/ui'
import { timeAgo } from '../../lib/time'
import { EffectPreview } from './EffectPreview'
import { DiffView, IssueList, OriginBadge, SideBySideDiff, YamlEditor } from './parts'
import { confirmDialog } from '../../lib/dialog'
import { Breadcrumbs } from '../../components/Breadcrumbs'

export function ConfigDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { canIn } = useAuth()

  const [selected, setSelected] = useState<number | null>(null)
  const [draft, setDraft] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [mode, setMode] = useState<'content' | 'compare' | 'preview'>('content')
  const showDiff = mode === 'compare'
  const previewing = mode === 'preview'
  // The version compared against; null follows the shown version (the one before it, or the saved text while editing).
  const [base, setBase] = useState<number | null>(null)
  const [layout, setLayout] = useState<'split' | 'unified'>('split')
  const [issues, setIssues] = useState<Issue[] | null>(null)

  const detail = useQuery({ queryKey: ['configs', id], queryFn: () => api.config(id) })
  const config = detail.data?.config
  const versionNo = selected ?? config?.latest_version ?? 0
  const version = useQuery({
    queryKey: ['configs', id, 'version', versionNo],
    queryFn: () => api.configVersion(id, versionNo),
    enabled: versionNo > 0,
    staleTime: Infinity,
  })

  const select = (n: number) => {
    setSelected(n)
    setDraft(null)
    setIssues(null)
  }

  const saved = version.data?.body ?? ''
  const body = draft ?? saved
  const dirty = draft !== null && draft !== saved
  const mayEdit = config !== undefined && canIn(config.project_id, 'operator')
  const editable = config?.origin === 'ui' && mayEdit

  const numbers = (detail.data?.versions ?? []).map((v) => v.version)
  const older = numbers.filter((n) => n < versionNo)
  const newer = numbers.filter((n) => n > versionNo)
  const neighbour = older.length > 0 ? Math.max(...older) : newer.length > 0 ? Math.min(...newer) : 0
  const baseNo = base !== null && numbers.includes(base) ? base : dirty ? versionNo : neighbour
  const diffing = showDiff && baseNo > 0
  const compared = useQuery({
    queryKey: ['configs', id, 'version', baseNo],
    queryFn: () => api.configVersion(id, baseNo),
    enabled: diffing,
    staleTime: Infinity,
  })
  const versionOptions = (detail.data?.versions ?? []).map((v) => ({
    value: String(v.version),
    label: `v${v.version}${v.version === config?.latest_version ? ' (latest)' : ''}`,
    hint: `${v.author} · ${timeAgo(v.created_at)}${v.description ? ` · ${v.description}` : ''}`,
  }))

  const validate = useMutation({ mutationFn: () => api.validateConfig(body), onSuccess: (r) => setIssues(r.issues) })
  const save = useMutation({
    mutationFn: () => api.addConfigVersion(id, body, description.trim()),
    onSuccess: async (v) => {
      await qc.invalidateQueries({ queryKey: ['configs'] })
      setDescription('')
      select(v.version)
    },
    onError: (e) => setIssues(e instanceof ApiError ? e.issues : null),
  })
  const remove = useMutation({
    mutationFn: () => api.deleteConfig(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['configs'] })
      navigate('/configs')
    },
  })

  if (detail.error) return <ErrorNote error={detail.error} />
  if (!config) return <p className="text-muted">Loading…</p>

  return (
    <div className="space-y-4">
      <Breadcrumbs items={[{ label: 'Configs', to: '/configs' }, { label: config?.name ?? 'Config' }]} />
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold">{config.name}</h1>
            <OriginBadge origin={config.origin} />
          </div>
          <p className="text-xs text-muted">
            {config.description && `${config.description} · `}
            Assigned to {config.assigned_agents.toLocaleString()} {config.assigned_agents === 1 ? 'agent' : 'agents'}
          </p>
        </div>
        {mayEdit && (
          <button
            className="btn btn-danger"
            disabled={config.assigned_agents > 0 || remove.isPending}
            title={config.assigned_agents > 0 ? 'Assigned to agents; reassign them first' : undefined}
            onClick={() => {
              void confirmDialog(`Delete "${config.name}" and all its versions?`).then((ok) => ok && remove.mutate())
            }}
          >
            Delete
          </button>
        )}
      </div>
      {remove.error && <p className="text-xs text-danger">{remove.error.message}</p>}
      {config.origin === 'git' && (
        <p className="card border-accent p-3 text-xs">This config is sourced from Git and is read-only here. Change it with a pull request.</p>
      )}

      <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
        <section className="card self-start">
          <h2 className="border-b border-border px-4 py-2 font-medium">Versions</h2>
          <ul>
            {detail.data?.versions.map((v) => (
              <li key={v.id}>
                <button
                  className={clsx('block w-full border-b border-border px-4 py-2 text-left last:border-b-0 hover:bg-hover', v.version === versionNo && 'bg-selected')}
                  onClick={() => select(v.version)}
                >
                  <div className="flex items-center justify-between gap-2 font-medium">
                    <span>
                      v{v.version}
                      {v.version === config.latest_version && <span className="ml-2 text-xs font-normal text-muted">latest</span>}
                    </span>
                    {(v.assigned_agents ?? 0) > 0 && (
                      <span className="chip h-5 text-[11px] font-normal">{v.assigned_agents!.toLocaleString()} {v.assigned_agents === 1 ? 'agent' : 'agents'}</span>
                    )}
                  </div>
                  <div className="text-xs text-muted">
                    {v.author} · {timeAgo(v.created_at)}
                  </div>
                  {v.description && <div className="truncate text-xs text-muted">{v.description}</div>}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="min-w-0 space-y-3">
          <div className="card">
            <div className="flex items-center justify-between border-b border-border px-4 py-2">
              <h2 className="font-medium">
                v{versionNo}
                {dirty && <span className="ml-2 text-xs font-normal text-warning">edited, not saved</span>}
              </h2>
              <div className="seg">
                <button className={diffing || previewing ? '' : 'active'} onClick={() => setMode('content')}>
                  Content
                </button>
                <button
                  className={diffing ? 'active' : ''}
                  disabled={numbers.length <= 1 && !dirty}
                  title={numbers.length <= 1 && !dirty ? 'There is only one version' : undefined}
                  onClick={() => setMode('compare')}
                >
                  Compare
                </button>
                <button className={previewing ? 'active' : ''} disabled={!body} title="See what the processors would do to sample telemetry" onClick={() => setMode('preview')}>
                  Preview effect
                </button>
              </div>
            </div>
            {diffing && (
              <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2 text-xs">
                <span className="text-muted">Changes from</span>
                <Select aria-label="Compare from version" className="w-36" value={String(baseNo)} onChange={(v) => setBase(Number(v))} options={versionOptions} />
                {dirty ? (
                  <span className="text-muted">to your unsaved edits of v{versionNo}</span>
                ) : (
                  <>
                    <button
                      className="btn btn-sm"
                      aria-label="Swap the two versions"
                      title="Swap the two versions"
                      onClick={() => {
                        setBase(versionNo)
                        select(baseNo)
                      }}
                    >
                      <ArrowLeftRight size={13} />
                    </button>
                    <span className="text-muted">to</span>
                    <Select aria-label="Compare to version" className="w-36" value={String(versionNo)} onChange={(v) => select(Number(v))} options={versionOptions} />
                  </>
                )}
                <div className="seg ml-auto">
                  <button className={layout === 'split' ? 'active' : ''} onClick={() => setLayout('split')}>
                    Side by side
                  </button>
                  <button className={layout === 'unified' ? 'active' : ''} onClick={() => setLayout('unified')}>
                    Unified
                  </button>
                </div>
              </div>
            )}
            {version.error ? (
              <ErrorNote error={version.error} />
            ) : previewing ? (
              <EffectPreview body={body} />
            ) : diffing ? (
              compared.error ? (
                <ErrorNote error={compared.error} />
              ) : !compared.data || !version.data ? (
                <p className="p-4 text-muted">Loading…</p>
              ) : layout === 'split' ? (
                <SideBySideDiff
                  before={compared.data.body ?? ''}
                  after={body}
                  beforeLabel={`v${baseNo}`}
                  afterLabel={dirty ? `v${versionNo}, edited` : `v${versionNo}`}
                />
              ) : (
                <DiffView before={compared.data.body ?? ''} after={body} />
              )
            ) : (
              <YamlEditor value={body} onChange={setDraft} readOnly={!editable} project={config?.project_id ?? null} />
            )}
          </div>

          {issues && (issues.length > 0 ? <IssueList issues={issues} /> : <p className="text-xs text-success">No issues found.</p>)}
          {save.error && !(save.error instanceof ApiError && save.error.issues.length > 0) && (
            <p className="text-xs text-danger">{save.error.message}</p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {editable && version.data?.builder_spec && versionNo === config.latest_version && (
              <Link to={`/configs/${id}/build`} className="btn btn-primary">
                Edit in builder
              </Link>
            )}
            <button className="btn" disabled={validate.isPending || !body} onClick={() => validate.mutate()}>
              Validate
            </button>
            {editable && (
              <>
                <input
                  className="input w-72"
                  placeholder="What changed? (optional)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={!dirty}
                />
                <button className="btn btn-primary" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
                  Save as v{config.latest_version + 1}
                </button>
                {dirty && (
                  <button className="btn btn-ghost" onClick={() => select(versionNo)}>
                    Discard
                  </button>
                )}
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
