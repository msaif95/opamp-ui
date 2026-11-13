import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { ArrowDown, ArrowLeft, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, ApiError, type BuilderComponent, type BuilderKind, type BuilderSpec, type BuilderType } from '../../api-client/client'
import { ProjectSelect } from '../../components/ProjectSelect'
import { ErrorNote } from '../../components/ui'
import { IssueList } from '../config-editor/parts'
import { ComponentForm } from './ComponentForm'
import { LibraryItemEditor } from './LibraryItemEditor'
import { promptDialog } from '../../lib/dialog'
import { Select } from '../../components/Select'

const EMPTY: BuilderSpec = { sources: [], processors: [], destinations: [] }

const columns: { kind: BuilderKind; key: keyof BuilderSpec; title: string; hint: string; add: string }[] = [
  { kind: 'source', key: 'sources', title: 'Sources', hint: 'Where telemetry comes from', add: 'Add source' },
  { kind: 'processor', key: 'processors', title: 'Processors', hint: 'Applied in this order', add: 'Add processor' },
  { kind: 'destination', key: 'destinations', title: 'Destinations', hint: 'Where telemetry is sent', add: 'Add destination' },
]

/** A short line describing a component's settings, for its card. */
function summary(c: BuilderComponent, type: BuilderType | undefined) {
  return (type?.fields ?? [])
    .map((f) => {
      const v = c.params[f.key] ?? f.default
      if (v === undefined || v === '' || v === false) return null
      if (Array.isArray(v)) return v.length ? v.join(', ') : null
      if (typeof v === 'object') return Object.keys(v).length ? Object.keys(v).join(', ') : null
      return v === true ? f.label : String(v)
    })
    .filter(Boolean)
    .join(' · ')
}

function BuilderBody({
  initial,
  configId,
  configName,
  configProject,
}: {
  initial: BuilderSpec
  configId?: string
  configName?: string
  /** Project of the config being edited. */
  configProject?: string | null
}) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [spec, setSpec] = useState<BuilderSpec>(initial)
  // Which component's form is open: column and index.
  const [open, setOpen] = useState<{ key: keyof BuilderSpec; index: number } | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  // A new config goes into the chosen project; an existing one stays where it is.
  const [chosenProject, setChosenProject] = useState<string | null | undefined>(configId ? (configProject ?? null) : undefined)
  const project = chosenProject ?? null

  const catalog = useQuery({ queryKey: ['builder-catalog'], queryFn: api.builderCatalog, staleTime: Infinity })
  const types = catalog.data?.types ?? []
  const typeOf = (kind: BuilderKind, type: string) => types.find((t) => t.kind === kind && t.type === type)
  const library = useQuery({ queryKey: ['builder-library'], queryFn: api.library })
  // Only pieces from the same project can be reused, so a config never depends on another project's settings.
  const items = (library.data?.items ?? []).filter((it) => it.project_id === project)
  const saveToLibrary = useMutation({
    mutationFn: (v: { kind: BuilderKind; key: keyof BuilderSpec; index: number; name: string; c: BuilderComponent }) =>
      api.saveLibraryItem({ kind: v.kind, name: v.name, type: v.c.type, params: v.c.params, project_id: project }),
    onSuccess: async (item, v) => {
      await qc.invalidateQueries({ queryKey: ['builder-library'] })
      // The pipeline now refers to the saved item instead of holding its own copy.
      update(
        v.key,
        spec[v.key].map((x, j) => (j === v.index ? { type: item.type, params: {}, library: item.id } : x)),
      )
    },
  })

  const empty = spec.sources.length + spec.processors.length + spec.destinations.length === 0
  const preview = useQuery({
    queryKey: ['builder-render', spec],
    queryFn: () => api.builderRender(spec),
    enabled: !empty,
    placeholderData: keepPreviousData,
  })
  const errors = preview.data?.issues.some((i) => i.severity === 'error') ?? true

  const save = useMutation({
    mutationFn: async () =>
      configId
        ? (await api.addBuiltVersion(configId, spec, description.trim())).template_id
        : (await api.createBuiltConfig(name.trim(), description.trim(), spec, project)).config.id,
    onSuccess: async (savedId) => {
      await qc.invalidateQueries({ queryKey: ['configs'] })
      navigate(`/configs/${savedId}`)
    },
  })

  const update = (key: keyof BuilderSpec, list: BuilderComponent[]) => setSpec({ ...spec, [key]: list })
  const add = (key: keyof BuilderSpec, choice: string) => {
    const [from, value] = [choice.slice(0, 4), choice.slice(5)]
    const item = items.find((it) => it.id === value)
    update(key, [...spec[key], from === 'item' && item ? { type: item.type, params: {}, library: item.id } : { type: value, params: {} }])
    setOpen({ key, index: spec[key].length })
  }
  const remove = (key: keyof BuilderSpec, index: number) => {
    update(
      key,
      spec[key].filter((_, i) => i !== index),
    )
    setOpen(null)
  }
  const move = (key: keyof BuilderSpec, index: number, by: number) => {
    const list = [...spec[key]]
    ;[list[index], list[index + by]] = [list[index + by], list[index]]
    update(key, list)
    setOpen(null)
  }

  if (catalog.error) return <ErrorNote error={catalog.error} />
  return (
    <div className="space-y-4">
      <Link to={configId ? `/configs/${configId}` : '/configs'} className="inline-flex items-center gap-1 text-xs text-muted hover:text-fg">
        <ArrowLeft size={13} /> {configName ?? 'Configs'}
      </Link>
      <div>
        <h1 className="text-lg font-semibold">{configId ? `Edit ${configName} in the builder` : 'Build a config'}</h1>
        <p className="text-xs text-muted">
          Pick where telemetry comes from, what to do with it and where to send it. Logs, metrics and traces are each routed only through
          the pieces that handle them. The collector config is generated for you and shown below.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {columns.map((col) => (
          <section key={col.key} className="card self-start">
            <div className="border-b border-border px-4 py-2">
              <h2 className="font-medium">{col.title}</h2>
              <p className="text-xs text-muted">{col.hint}</p>
            </div>
            <ul>
              {spec[col.key].map((c, i) => {
                const item = c.library ? items.find((it) => it.id === c.library) : undefined
                const type = typeOf(col.kind, item?.type ?? c.type)
                const shown = item ? { type: item.type, params: item.params } : c
                const isOpen = open?.key === col.key && open.index === i
                return (
                  <li key={i} className={clsx('border-b border-border', isOpen && 'bg-panel-2')}>
                    <div className="flex items-start gap-2 px-4 py-2">
                      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setOpen(isOpen ? null : { key: col.key, index: i })}>
                        <div className="font-medium">
                          {item ? item.name : (type?.label ?? c.type)}
                          {c.library && <span className="ml-2 text-xs font-normal text-accent">{item ? `library · ${type?.label}` : 'missing library item'}</span>}
                        </div>
                        <div className="truncate text-xs text-muted">{summary(shown, type) || type?.signals.join(', ')}</div>
                      </button>
                      {col.key === 'processors' && (
                        <>
                          <button className="btn btn-ghost btn-sm" disabled={i === 0} onClick={() => move(col.key, i, -1)} aria-label="Move up">
                            <ArrowUp size={13} />
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            disabled={i === spec[col.key].length - 1}
                            onClick={() => move(col.key, i, 1)}
                            aria-label="Move down"
                          >
                            <ArrowDown size={13} />
                          </button>
                        </>
                      )}
                      <button className="btn btn-ghost btn-sm" onClick={() => remove(col.key, i)} aria-label={`Remove ${type?.label ?? c.type}`}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                    {isOpen && type && item && (
                      <LibraryItemEditor
                        key={item.id + item.updated_at}
                        item={item}
                        type={type}
                        onDetach={() =>
                          update(
                            col.key,
                            spec[col.key].map((x, j) => (j === i ? { type: item.type, params: item.params } : x)),
                          )
                        }
                      />
                    )}
                    {isOpen && type && !c.library && (
                      <div className="space-y-3 px-4 pb-3">
                        <p className="text-xs text-muted">{type.description}</p>
                        <ComponentForm
                          type={type}
                          params={c.params}
                          onChange={(params) =>
                            update(
                              col.key,
                              spec[col.key].map((x, j) => (j === i ? { ...x, params } : x)),
                            )
                          }
                        />
                        <button
                          className="btn btn-sm"
                          disabled={saveToLibrary.isPending}
                          onClick={() => {
                            void promptDialog({ title: `Save this ${col.kind} to the library`, label: 'Name', placeholder: 'e.g. central-gateway' }).then(
                              (name) => name && saveToLibrary.mutate({ kind: col.kind, key: col.key, index: i, name, c }),
                            )
                          }}
                        >
                          Save to library for reuse
                        </button>
                        {saveToLibrary.error && <p className="text-xs text-danger">{saveToLibrary.error.message}</p>}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
            <div className="p-3">
              <Select
                className="w-full"
                value=""
                placeholder={`+ ${col.add}…`}
                aria-label={col.add}
                onChange={(v) => v && add(col.key, v)}
                options={[
                  ...items.filter((it) => it.kind === col.kind).map((it) => ({ value: `item:${it.id}`, label: it.name, group: 'From the library' })),
                  ...types
                    .filter((t) => t.kind === col.kind)
                    .map((t) => ({ value: `type:${t.type}`, label: t.label, hint: t.signals.join(', '), group: 'New' })),
                ]}
              />
            </div>
          </section>
        ))}
      </div>

      {!empty && preview.data && <IssueList issues={preview.data.issues} />}

      <section className="card">
        <h2 className="border-b border-border px-4 py-2 font-medium">Generated collector config</h2>
        {empty ? (
          <p className="flex items-center gap-2 p-4 text-muted">
            <Plus size={14} /> Add a source and a destination to see the config.
          </p>
        ) : preview.data?.body ? (
          <pre className="max-h-96 overflow-auto p-4 font-mono text-xs leading-5">{preview.data.body}</pre>
        ) : (
          <p className="p-4 text-muted">Fix the problems above to see the config.</p>
        )}
      </section>

      <section className="card flex flex-wrap items-end gap-3 p-4">
        {!configId && <ProjectSelect value={chosenProject} onChange={setChosenProject} />}
        {!configId && (
          <label className="space-y-1">
            <span className="block text-xs text-muted">Config name</span>
            <input className="input w-64" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. linux-hosts" />
          </label>
        )}
        <label className="flex-1 space-y-1">
          <span className="block text-xs text-muted">{configId ? 'What changed? (optional)' : 'Description (optional)'}</span>
          <input className="input w-full" value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <button className="btn btn-primary" disabled={errors || (!configId && !name.trim()) || save.isPending} onClick={() => save.mutate()}>
          {configId ? 'Save as new version' : 'Create config'}
        </button>
        {save.error &&
          (save.error instanceof ApiError && save.error.issues.length > 0 ? (
            <div className="w-full">
              <IssueList issues={save.error.issues} />
            </div>
          ) : (
            <p className="w-full text-xs text-danger">{save.error.message}</p>
          ))}
      </section>
    </div>
  )
}

/** Builds a collector config from sources, processors and destinations instead of hand-written YAML. */
export function PipelineBuilder() {
  const { id } = useParams()
  const detail = useQuery({ queryKey: ['configs', id], queryFn: () => api.config(id!), enabled: id !== undefined })
  const latest = detail.data?.config.latest_version
  const version = useQuery({
    queryKey: ['configs', id, 'version', latest],
    queryFn: () => api.configVersion(id!, latest!),
    enabled: id !== undefined && latest !== undefined,
  })

  if (!id) return <BuilderBody initial={EMPTY} />
  if (detail.error || version.error) return <ErrorNote error={detail.error ?? version.error} />
  if (!detail.data || !version.data) return <p className="text-muted">Loading…</p>
  if (!version.data.builder_spec) {
    return (
      <div className="space-y-3">
        <p>The latest version of this config was written as YAML, so it cannot be opened in the builder.</p>
        <Link to={`/configs/${id}`} className="btn">
          Back to the config
        </Link>
      </div>
    )
  }
  return <BuilderBody key={version.data.id} initial={version.data.builder_spec} configId={id} configName={detail.data.config.name} configProject={detail.data.config.project_id} />
}
