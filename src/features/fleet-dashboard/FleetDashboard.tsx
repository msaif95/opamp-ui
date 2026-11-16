import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ArrowDown, ArrowUp, Download, GitCompareArrows, Pause, Play, Plus, RefreshCw, RotateCw, Search, Server, Tag, Trash2, X } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api, type Agent, type AgentQuery, type BulkAgentAction, type LabelChange } from '../../api-client/client'
import { useAuth } from '../../auth/AuthProvider'
import { Modal } from '../../components/Dialogs'
import { EmptyState } from '../../components/EmptyState'
import { LabelChips, LabelForm } from '../../components/Labels'
import { ProjectName, useHasProjects } from '../../components/ProjectSelect'
import { AgentStatus, ConfigStatus, ErrorNote, PageHeader } from '../../components/ui'
import { groupFailures } from '../../lib/bulk'
import { LABEL_PREFIX } from '../../lib/labels'
import { confirmDialog } from '../../lib/dialog'
import { timeAgo } from '../../lib/time'
import { toast } from '../../lib/toast'
import { Select } from '../../components/Select'
import { RemovedCollectors } from './Removed'
import { SavedViews } from './SavedViews'

const PAGE_SIZE = 50
/** Safety-net refresh for "last seen"; real changes arrive through the event stream. */
const BACKGROUND_REFRESH_MS = 30_000

/** One view per summary card; each maps to a server-side filter. */
const views = {
  all: { label: 'All', filter: {} },
  connected: { label: 'Connected', filter: { connected: true } },
  offline: { label: 'Offline', filter: { connected: false } },
  healthy: { label: 'Healthy', filter: { connected: true, healthy: true } },
  unhealthy: { label: 'Unhealthy', filter: { connected: true, healthy: false } },
  config_failed: { label: 'Config failed', filter: { configStatus: 'failed' } },
  // Not a filter on the fleet: the records of collectors removed from it (see RemovedCollectors).
  removed: { label: 'Removed', filter: {} },
} satisfies Record<string, { label: string; filter: Partial<AgentQuery> }>
type View = keyof typeof views

/** The server takes this many collectors in one bulk action. */
const BULK_LIMIT = 500
/** What a finished bulk action is called, and how its success reads. */
const bulkName = (action: BulkAgentAction) => (action === 'label' ? 'label' : BULK[action].action.toLowerCase())
const bulkDone = (action: BulkAgentAction, n: number) => (action === 'label' ? `Labels changed on ${plural(n)}` : BULK[action].done(n))
const hostOf = (a: Agent) => a.attributes['host.name'] ?? a.instance_uid
const plural = (n: number) => `${n.toLocaleString()} ${n === 1 ? 'collector' : 'collectors'}`

/** Wording for each bulk action: the question asked first, and the summary shown afterwards. */
const BULK: Record<Exclude<BulkAgentAction, 'label'>, { title: (n: number) => string; body: string; action: string; danger?: boolean; done: (n: number) => string }> = {
  restart: {
    title: (n) => `Restart ${plural(n)}?`,
    body: 'Each stops collecting for a few seconds while it restarts. Collectors that are offline or do not accept restart commands are skipped.',
    action: 'Restart',
    done: (n) => `Restart requested for ${plural(n)}`,
  },
  pause: {
    title: (n) => `Stop collection on ${plural(n)}?`,
    body: 'They stay connected but collect and send nothing until resumed. Collectors without an assigned config are skipped.',
    action: 'Stop collection',
    danger: true,
    done: (n) => `Collection stopped on ${plural(n)}`,
  },
  resume: {
    title: (n) => `Resume collection on ${plural(n)}?`,
    body: 'Each goes back to its assigned config.',
    action: 'Resume collection',
    done: (n) => `Collection resumed on ${plural(n)}`,
  },
  delete: {
    title: (n) => `Remove ${plural(n)} from the fleet?`,
    body: 'They leave the fleet, and a record of each is kept with its history in the Removed view. Only offline collectors can be removed; one that connects again later is registered as new.',
    action: 'Remove',
    danger: true,
    done: (n) => `Removed ${plural(n)}`,
  },
}

function StatCard({ label, value, tone, active, onClick }: { label: string; value: number | undefined; tone?: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={clsx('card px-4 py-3 text-left transition-colors hover:border-accent', active && 'border-accent ring-2 ring-accent/20')}
    >
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className={clsx('mt-0.5 text-2xl font-semibold tracking-tight', tone)}>{value?.toLocaleString() ?? '–'}</div>
    </button>
  )
}

export function FleetDashboard() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { can } = useAuth()
  const operator = can('operator')
  // Other pages link here with filters already applied: ?view=unhealthy, ?attr=region=eu, ?q=…, ?group=…, ?project=….
  const [params, setParams] = useSearchParams()
  const [page, setPage] = useState(0)
  const [view, setView] = useState<View>(() => (params.get('view') && params.get('view')! in views ? (params.get('view') as View) : 'all'))
  const [sort, setSort] = useState<AgentQuery['sort']>('name')
  const [order, setOrder] = useState<AgentQuery['order']>('asc')
  const [attrs, setAttrs] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      params
        .getAll('attr')
        .map((kv) => [kv.slice(0, kv.indexOf('=')), kv.slice(kv.indexOf('=') + 1)])
        .filter(([k]) => k),
    ),
  )
  const [groupId, setGroupId] = useState(() => params.get('group') ?? '')
  const [project, setProject] = useState(() => params.get('project') ?? '')
  // Free-text search: what is typed, and what is sent once typing pauses.
  const [searchText, setSearchText] = useState(() => params.get('q') ?? '')
  const [search, setSearch] = useState(searchText)
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchText.trim())
      setPage(0)
    }, 250)
    return () => clearTimeout(timer)
  }, [searchText])
  // Ticked collectors (instance UID -> host name), kept across pages and filters: for bulk actions, or two to compare.
  const [picked, setPicked] = useState<Record<string, string>>({})
  const pickedIds = Object.keys(picked)
  const [labelling, setLabelling] = useState(false)
  const bulk = useMutation({
    mutationFn: ({ action, uids, labels }: { action: BulkAgentAction; uids: string[]; labels?: LabelChange }) => api.bulkAgents(action, uids, labels),
    onSuccess: (out, { action }) => {
      setLabelling(false)
      if (out.succeeded > 0) toast({ title: bulkDone(action, out.succeeded), body: out.failed > 0 ? `${plural(out.failed)} skipped; the reasons are listed above the table.` : undefined, tone: out.failed > 0 ? 'warning' : 'success' })
      // Removed collectors leave the selection; the rest stay ticked for a follow-up action.
      if (action === 'delete') setPicked((now) => Object.fromEntries(Object.entries(now).filter(([uid]) => !out.results.some((r) => r.ok && r.instance_uid === uid))))
      void refresh()
    },
  })
  const skipped = bulk.data && bulk.data.failed > 0 ? groupFailures(bulk.data.results, (uid) => picked[uid] ?? uid) : []
  const runBulk = (action: Exclude<BulkAgentAction, 'label'>) => {
    const { title, body, action: label, danger } = BULK[action]
    void confirmDialog({ title: title(pickedIds.length), body, action: label, danger }).then((ok) => ok && bulk.mutate({ action, uids: pickedIds }))
  }
  const exporting = useMutation({ mutationFn: (format: 'csv' | 'json') => api.exportAgents(query, format) })
  const { user } = useAuth()
  const hasProjects = useHasProjects()
  const groups = useQuery({ queryKey: ['groups'], queryFn: api.groups })
  const [filterText, setFilterText] = useState('')
  const [filterError, setFilterError] = useState(false)

  /** The project filter value for a group's project. */
  const projectOf = (id: string) => groups.data?.groups.find((g) => g.id === id)?.project_id ?? 'none'
  const summary = useQuery({ queryKey: ['summary', project, groupId], queryFn: () => api.summary(project || undefined, groupId || undefined), refetchInterval: BACKGROUND_REFRESH_MS })
  const query: AgentQuery = { limit: PAGE_SIZE, offset: page * PAGE_SIZE, sort, order, attrs, groupId: groupId || undefined, project: project || undefined, search: search || undefined, ...views[view].filter }
  const agents = useQuery({
    queryKey: ['agents', query],
    queryFn: () => api.agents(query),
    placeholderData: keepPreviousData,
    refetchInterval: BACKGROUND_REFRESH_MS,
    enabled: view !== 'removed',
  })

  const show = (v: View) => {
    setView(v)
    setPage(0)
    // Keep the address in step, so a reload or a shared link opens the same view.
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        if (v === 'all') next.delete('view')
        else next.set('view', v)
        return next
      },
      { replace: true },
    )
  }
  const sortBy = (column: AgentQuery['sort']) => {
    if (column === sort) {
      setOrder(order === 'asc' ? 'desc' : 'asc')
    } else {
      setSort(column)
      setOrder(column === 'name' ? 'asc' : 'desc')
    }
    setPage(0)
  }
  const addFilter = (e: FormEvent) => {
    e.preventDefault()
    const i = filterText.indexOf('=')
    if (i <= 0) return setFilterError(true)
    setAttrs({ ...attrs, [filterText.slice(0, i).trim()]: filterText.slice(i + 1).trim() })
    setFilterText('')
    setFilterError(false)
    setPage(0)
  }
  const removeFilter = (key: string) => {
    setAttrs(Object.fromEntries(Object.entries(attrs).filter(([k]) => k !== key)))
    setPage(0)
  }
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ['agents'] }), qc.invalidateQueries({ queryKey: ['summary'] })])

  const total = agents.data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const s = summary.data
  const onPage = agents.data?.agents ?? []
  const allOnPage = onPage.length > 0 && onPage.every((a) => a.instance_uid in picked)
  const tooMany = pickedIds.length > BULK_LIMIT ? `Select at most ${BULK_LIMIT} collectors for one action` : undefined

  const sortHeader = (column: AgentQuery['sort'], label: string) => (
    <th aria-sort={sort === column ? (order === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="inline-flex items-center gap-1 hover:text-fg" onClick={() => sortBy(column)}>
        {label}
        {sort === column && (order === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
      </button>
    </th>
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title="Fleet"
        action={
          <>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger className="btn" disabled={exporting.isPending}>
                <Download size={14} /> {exporting.isPending ? 'Exporting…' : 'Export'}
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content align="end" sideOffset={4} className="z-50 min-w-56 rounded-md border border-border bg-panel p-1 shadow-lg">
                  <DropdownMenu.Label className="px-2 py-1 text-xs text-muted">
                    The {total.toLocaleString()} collectors matching the filters, with every attribute
                  </DropdownMenu.Label>
                  {(['csv', 'json'] as const).map((format) => (
                    <DropdownMenu.Item
                      key={format}
                      className="cursor-default select-none rounded px-2 py-1.5 outline-none data-[highlighted]:bg-accent-soft data-[highlighted]:text-accent"
                      onSelect={() => exporting.mutate(format)}
                    >
                      Download as {format.toUpperCase()}
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
            <button className="btn" onClick={refresh} disabled={agents.isFetching}>
              <RefreshCw size={13} className={agents.isFetching ? 'animate-spin' : ''} /> Refresh
            </button>
            {can('admin') && (
              <Link to="/agents/install" className="btn btn-primary">
                <Plus size={14} /> Add collectors
              </Link>
            )}
          </>
        }
      />

      {exporting.error && <ErrorNote error={exporting.error} />}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Total agents" value={s?.total} active={view === 'all'} onClick={() => show('all')} />
        <StatCard label="Connected" value={s?.connected} active={view === 'connected'} onClick={() => show('connected')} />
        <StatCard label="Healthy" value={s?.healthy} tone="text-success" active={view === 'healthy'} onClick={() => show('healthy')} />
        <StatCard
          label="Unhealthy"
          value={s?.unhealthy}
          tone={s?.unhealthy ? 'text-danger' : undefined}
          active={view === 'unhealthy'}
          onClick={() => show('unhealthy')}
        />
        <StatCard
          label="Config failed"
          value={s?.config_failed}
          tone={s?.config_failed ? 'text-danger' : undefined}
          active={view === 'config_failed'}
          onClick={() => show('config_failed')}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SavedViews
          current={{ view, project, group: groupId, q: search, attrs }}
          names={{ project: (id) => user?.projects.find((p) => p.id === id)?.name ?? id.slice(0, 8), group: (id) => groups.data?.groups.find((g) => g.id === id)?.name ?? id.slice(0, 8) }}
          onApply={(f) => {
            show(f.view in views ? (f.view as View) : 'all')
            setProject(f.project)
            setGroupId(f.group)
            setSearchText(f.q)
            setSearch(f.q)
            setAttrs(f.attrs)
          }}
        />
        <div className="seg">
          {(['all', 'connected', 'offline', 'removed'] as const).map((v) => (
            <button key={v} className={view === v ? 'active' : ''} onClick={() => show(v)}>
              {views[v].label}
            </button>
          ))}
        </div>
        {view !== 'all' && view !== 'connected' && view !== 'offline' && view !== 'removed' && (
          <span className="chip border-accent text-accent">
            {views[view].label}
            <button onClick={() => show('all')} aria-label="Clear status filter">
              <X size={12} />
            </button>
          </span>
        )}
        {hasProjects && (
          <Select
            className="w-44"
            value={project}
            aria-label="Project"
            onChange={(v) => {
              setProject(v)
              // A group belongs to one project, so it cannot stay selected under a different one.
              if (groupId && v !== '' && projectOf(groupId) !== v) setGroupId('')
              setPage(0)
            }}
            options={[
              { value: '', label: 'All projects' },
              ...(user?.projects ?? []).map((p) => ({ value: p.id, label: p.name })),
              ...(user?.admin || user?.role ? [{ value: 'none', label: 'No project' }] : []),
            ]}
          />
        )}
        {view !== 'removed' && (groups.data?.groups.length ?? 0) > 0 && (
          <Select
            className="w-48"
            value={groupId}
            aria-label="Group"
            onChange={(v) => {
              setGroupId(v)
              // Picking a group shows its project, so the two filters and the cards always agree.
              if (v && hasProjects) setProject(projectOf(v))
              setPage(0)
            }}
            options={[
              { value: '', label: 'All groups' },
              // With a project chosen, only that project's groups are offered.
              ...(groups.data?.groups ?? [])
                .filter((g) => project === '' || (g.project_id ?? 'none') === project)
                .map((g) => ({ value: g.id, label: g.name, hint: `${g.members.toLocaleString()} agents` })),
            ]}
          />
        )}
        <div className="relative">
          <Search size={13} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <input
            className="input w-64 pl-7"
            type="search"
            placeholder="Search host, IP, UID or attribute"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            aria-label="Search collectors"
          />
        </div>
        {view !== 'removed' && (
          <form onSubmit={addFilter}>
            <input
              className={`input w-56 ${filterError ? 'border-danger' : ''}`}
              placeholder="Filter: key=value (e.g. env=prod)"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
            />
          </form>
        )}
        {view !== 'removed' && Object.entries(attrs).map(([k, v]) => (
          <span key={k} className="chip">
            {k}={v}
            <button onClick={() => removeFilter(k)} aria-label={`Remove filter ${k}`}>
              <X size={12} />
            </button>
          </span>
        ))}
      </div>

      {view === 'removed' ? (
        <RemovedCollectors search={search} project={project} showProject={hasProjects} />
      ) : s?.total === 0 && !search && Object.keys(attrs).length === 0 && !groupId && !project ? (
        <EmptyState
          icon={Server}
          title="No collectors yet"
          action={
            can('admin') ? (
              <Link to="/agents/install" className="btn btn-primary">
                <Plus size={14} /> Add collectors
              </Link>
            ) : undefined
          }
        >
          <p>
            Collectors appear here as soon as they connect. The console generates an install script that downloads the OpenTelemetry
            Collector and its OpAMP Supervisor and points them at this backend.
          </p>
          {!can('admin') && <p>Ask an administrator to add collectors to one of your projects.</p>}
        </EmptyState>
      ) : (
      <>
      {pickedIds.length > 0 && (
        <div role="region" aria-label="Selected collectors" className="card flex flex-wrap items-center gap-2 border-accent px-3 py-2">
          <span className="mr-1 text-xs font-medium" aria-live="polite">
            {pickedIds.length.toLocaleString()} selected
          </span>
          {operator && (
            <>
              <button className="btn btn-sm" disabled={bulk.isPending || !!tooMany} title={tooMany} onClick={() => runBulk('restart')}>
                <RotateCw size={12} /> Restart
              </button>
              <button className="btn btn-sm" disabled={bulk.isPending || !!tooMany} title={tooMany} onClick={() => runBulk('pause')}>
                <Pause size={12} /> Stop collection
              </button>
              <button className="btn btn-sm" disabled={bulk.isPending || !!tooMany} title={tooMany} onClick={() => runBulk('resume')}>
                <Play size={12} /> Resume collection
              </button>
              <button className="btn btn-sm" disabled={bulk.isPending || !!tooMany} title={tooMany} onClick={() => setLabelling(true)}>
                <Tag size={12} /> Label
              </button>
              <button className="btn btn-sm text-danger" disabled={bulk.isPending || !!tooMany} title={tooMany} onClick={() => runBulk('delete')}>
                <Trash2 size={12} /> Remove
              </button>
            </>
          )}
          {pickedIds.length === 2 && (
            <Link to={`/agents/compare?a=${pickedIds[0]}&b=${pickedIds[1]}`} className="btn btn-sm">
              <GitCompareArrows size={12} /> Compare
            </Link>
          )}
          {bulk.isPending && <span className="text-xs text-muted">Working…</span>}
          <button className="btn btn-sm btn-ghost ml-auto" onClick={() => setPicked({})}>
            <X size={12} /> Clear selection
          </button>
        </div>
      )}
      {bulk.error && !labelling && <ErrorNote error={bulk.error} />}
      <Modal
        open={labelling}
        onClose={() => setLabelling(false)}
        size="lg"
        title={`Label ${plural(pickedIds.length)}`}
        description={`Your own name=value tags. Labels not mentioned here are left as they are. In groups, bulk pushes and filters a label is picked as ${LABEL_PREFIX}name.`}
      >
        {labelling && (
          <LabelForm
            pending={bulk.isPending}
            error={bulk.error}
            onCancel={() => setLabelling(false)}
            onSubmit={(labels) => bulk.mutate({ action: 'label', uids: pickedIds, labels })}
          />
        )}
      </Modal>
      {skipped.length > 0 && (
        <div role="status" className="card border-warning p-3 text-xs">
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium">
              {bulk.data!.succeeded === 0 ? 'Nothing was changed' : `${plural(bulk.data!.failed)} skipped`}: {bulkName(bulk.variables!.action)}
            </p>
            <button onClick={() => bulk.reset()} aria-label="Dismiss">
              <X size={12} />
            </button>
          </div>
          <ul className="mt-1 space-y-1">
            {skipped.map((g) => (
              <li key={g.reason}>
                <span className="text-muted">{g.reason}:</span>{' '}
                <span className="font-mono">{g.names.slice(0, 10).join(', ')}</span>
                {g.names.length > 10 && <span className="text-muted"> and {(g.names.length - 10).toLocaleString()} more</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="card overflow-auto">
        {agents.error ? (
          <ErrorNote error={agents.error} />
        ) : (
          <table className="table dense">
            <thead>
              <tr>
                <th className="w-8">
                  <input
                    type="checkbox"
                    className="accent-[var(--c-accent)]"
                    checked={allOnPage}
                    disabled={onPage.length === 0}
                    onChange={(e) =>
                      setPicked(
                        e.target.checked
                          ? { ...picked, ...Object.fromEntries(onPage.map((a) => [a.instance_uid, hostOf(a)])) }
                          : Object.fromEntries(Object.entries(picked).filter(([uid]) => !onPage.some((a) => a.instance_uid === uid))),
                      )
                    }
                    aria-label="Select every collector on this page"
                  />
                </th>
                <th>Status</th>
                {sortHeader('name', 'Host')}
                {hasProjects && <th>Project</th>}
                <th>Service</th>
                <th>Version</th>
                <th>Env</th>
                <th>Region</th>
                <th>Labels</th>
                <th>Connector</th>
                <th>Auth</th>
                <th>Remote config</th>
                {sortHeader('last_seen', 'Last seen')}
              </tr>
            </thead>
            <tbody>
              {agents.data?.agents.map((a) => (
                <tr key={a.instance_uid} className="cursor-pointer" onClick={() => navigate(`/agents/${a.instance_uid}`)}>
                  <td onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="accent-[var(--c-accent)]"
                      checked={a.instance_uid in picked}
                      onChange={(e) =>
                        setPicked(e.target.checked ? { ...picked, [a.instance_uid]: hostOf(a) } : Object.fromEntries(Object.entries(picked).filter(([uid]) => uid !== a.instance_uid)))
                      }
                      aria-label={`Select ${hostOf(a)}`}
                    />
                  </td>
                  <td>
                    <AgentStatus agent={a} />
                  </td>
                  <td className="font-mono text-xs">{a.attributes['host.name'] ?? a.instance_uid}</td>
                  {hasProjects && (
                    <td>
                      <ProjectName id={a.project_id} />
                    </td>
                  )}
                  <td>{a.attributes['service.name'] ?? '–'}</td>
                  <td>{a.agent_version ?? '–'}</td>
                  <td>{a.attributes['env'] ?? '–'}</td>
                  <td>{a.attributes['region'] ?? '–'}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <LabelChips
                      labels={a.labels}
                      max={3}
                      onPick={(k, v) => {
                        setAttrs({ ...attrs, [LABEL_PREFIX + k]: v })
                        setPage(0)
                      }}
                    />
                  </td>
                  <td>
                    {a.connector_type === 'k8s_bridge' ? 'Kubernetes bridge' : a.connector_type}
                    {a.transport === 'http' && <span className="ml-1 text-xs text-muted">(HTTP polling)</span>}
                  </td>
                  <td>{a.auth_mode === 'mtls' ? 'mTLS' : 'API key'}</td>
                  <td>
                    <ConfigStatus status={a.remote_config_status} />
                  </td>
                  <td className="text-muted">{timeAgo(a.last_seen)}</td>
                </tr>
              ))}
              {agents.data?.agents.length === 0 && (
                <tr>
                  <td colSpan={13} className="py-8 text-center text-muted">
                    No collectors match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
      </>
      )}

      <div className={clsx('flex items-center justify-between text-xs text-muted', view === 'removed' && 'hidden')}>
        <span>{total.toLocaleString()} agents</span>
        <div className="flex items-center gap-2">
          <button className="btn btn-sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
            Previous
          </button>
          <span>
            Page {page + 1} of {pages}
          </span>
          <button className="btn btn-sm" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>
            Next
          </button>
        </div>
      </div>
    </div>
  )
}
