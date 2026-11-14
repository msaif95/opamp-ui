import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { FileCode, FolderKanban, Plus, Rocket, Server, Tags } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from 'recharts'
import { api, type Agent, type AgentQuery, type TrendPoint } from '../../api-client/client'
import { useAuth } from '../../auth/AuthProvider'
import { EmptyState } from '../../components/EmptyState'
import { AgentStatus, ErrorNote, PageHeader } from '../../components/ui'
import { timeAgo, useNow } from '../../lib/time'
import { ProgressBar, RolloutStatusBadge } from '../rollout-console/parts'

type Metric = Exclude<keyof TrendPoint, 'at'>

/** A headline number with its trend over the last 24 hours; the whole card links to the matching fleet view. */
function Kpi({ label, value, metric, points, to, color, alarming }: { label: string; value: number | undefined; metric: Metric; points: TrendPoint[]; to: string; color: string; alarming?: boolean }) {
  const first = points[0]?.[metric]
  const change = value !== undefined && first !== undefined ? value - first : 0
  return (
    <Link to={to} className="card block px-4 pb-2 pt-3 transition-colors hover:border-accent">
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className="flex items-baseline gap-2">
        <span className={clsx('text-2xl font-semibold tracking-tight', alarming && value ? 'text-danger' : undefined)}>{value?.toLocaleString() ?? '–'}</span>
        {points.length > 1 && (
          <span className="text-xs text-muted">
            {change === 0 ? 'no change' : `${change > 0 ? '+' : '−'}${Math.abs(change).toLocaleString()}`} in 24h
          </span>
        )}
      </div>
      <div className="mt-1 h-10" aria-hidden>
        {points.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 2, right: 0, bottom: 0, left: 0 }} accessibilityLayer={false}>
              <YAxis hide domain={[(min: number) => Math.max(0, Math.floor(min * 0.95)), (max: number) => Math.ceil(max * 1.05) || 1]} />
              <Tooltip
                labelFormatter={(_, payload) => (payload[0] ? new Date(payload[0].payload.at).toLocaleString() : '')}
                formatter={(v) => [Number(v).toLocaleString(), label]}
                contentStyle={{ background: 'var(--c-panel)', border: '1px solid var(--c-border)', borderRadius: 6, fontSize: 12 }}
              />
              <Area dataKey={metric} stroke={color} fill={color} fillOpacity={0.12} strokeWidth={1.5} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-end text-[11px] text-faint">Trend appears after a few minutes</div>
        )}
      </div>
    </Link>
  )
}

/** A short list of collectors in some trouble, with a link to all of them. */
function AttentionList({ title, filter, view, reason }: { title: string; filter: Partial<AgentQuery>; view: string; reason: (a: Agent) => string }) {
  const { data, error } = useQuery({
    queryKey: ['agents', 'attention', view],
    queryFn: () => api.agents({ limit: 5, offset: 0, sort: 'last_seen', order: 'desc', attrs: {}, ...filter }),
    refetchInterval: 30_000,
  })
  return (
    <section className="card">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <h2 className="font-medium">
          {title} {data && <span className="font-normal text-muted">({data.total.toLocaleString()})</span>}
        </h2>
        {(data?.total ?? 0) > 0 && (
          <Link to={`/agents?view=${view}`} className="text-xs font-medium text-accent hover:underline">
            View all
          </Link>
        )}
      </div>
      {error ? (
        <ErrorNote error={error} />
      ) : data?.agents.length === 0 ? (
        <p className="p-4 text-muted">None. </p>
      ) : (
        <ul className="divide-y divide-border">
          {data?.agents.map((a) => (
            <li key={a.instance_uid}>
              <Link to={`/agents/${a.instance_uid}`} className="flex items-center gap-3 px-4 py-2 hover:bg-hover">
                <AgentStatus agent={a} />
                <span className="shrink-0 font-mono text-xs">{a.attributes['host.name'] ?? a.instance_uid}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-muted">{reason(a)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** Landing page: how the fleet is doing now and over the last day, what needs attention, and recent activity. */
export function Overview() {
  const { can, user } = useAuth()
  const summary = useQuery({ queryKey: ['summary', '', ''], queryFn: () => api.summary(), refetchInterval: 30_000 })
  const trend = useQuery({ queryKey: ['summary', 'history'], queryFn: () => api.summaryHistory(24), refetchInterval: 60_000 })
  const rollouts = useQuery({ queryKey: ['rollouts'], queryFn: api.rollouts, refetchInterval: 15_000 })
  const system = useQuery({ queryKey: ['system'], queryFn: api.system, refetchInterval: 60_000, enabled: can('admin') })
  const configs = useQuery({ queryKey: ['configs'], queryFn: api.configs })
  const groups = useQuery({ queryKey: ['groups'], queryFn: api.groups })

  const s = summary.data
  const points = trend.data?.points ?? []
  const waiting = (rollouts.data?.rollouts ?? []).filter((r) => r.status === 'paused')
  const recent = (rollouts.data?.rollouts ?? []).slice(0, 5)
  const dayAgo = useNow(60_000) - 86_400_000
  const alerts = (system.data?.alerts ?? []).filter((a) => new Date(a.at).getTime() > dayAgo).slice(0, 5)

  if (summary.error) return <ErrorNote error={summary.error} />

  // Nothing connected yet: show the way in rather than a page of zeroes.
  if (s?.total === 0) {
    const steps = [
      { icon: FolderKanban, title: 'Create a project', text: 'Everything belongs to a project, and people get access project by project.', to: '/projects', done: (user?.projects.length ?? 0) > 0, admin: true },
      { icon: Server, title: 'Add collectors', text: 'Generate an install script that connects a collector to this console.', to: '/agents/install', done: false, admin: true },
      { icon: FileCode, title: 'Create a config', text: 'Build a pipeline from sources, processors and destinations, or write the YAML.', to: '/configs/build', done: (configs.data?.configs.length ?? 0) > 0 },
      { icon: Tags, title: 'Group collectors', text: 'Save a target such as "prod on AWS" to filter by and push to.', to: '/groups', done: (groups.data?.groups.length ?? 0) > 0 },
      { icon: Rocket, title: 'Push a config', text: 'Roll a config version out in batches that stop when collectors fail.', to: '/rollouts/new', done: (rollouts.data?.rollouts.length ?? 0) > 0 },
    ]
    return (
      <div className="space-y-4">
        <PageHeader title="Overview" />
        <EmptyState icon={Server} title="Welcome to OpAMP Fleet">
          <p>No collectors are connected yet. These are the steps from an empty console to a managed fleet.</p>
        </EmptyState>
        <ol className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {steps.map((step, i) => (
            <li key={step.title} className="card flex flex-col p-4">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent">{i + 1}</span>
                <h2 className="font-medium">{step.title}</h2>
                {step.done && <span className="text-xs text-success">Done</span>}
              </div>
              <p className="mt-2 flex-1 text-xs text-muted">{step.text}</p>
              {step.admin && !can('admin') ? (
                <p className="mt-3 text-xs text-muted">Needs an administrator.</p>
              ) : (
                <Link to={step.to} className="btn btn-sm mt-3 self-start">
                  <Plus size={13} /> {step.title}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Overview" description="How the fleet is doing now and over the last 24 hours, what needs attention, and recent bulk pushes." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Collectors" value={s?.total} metric="total" points={points} to="/agents" color="var(--c-accent)" />
        <Kpi label="Connected" value={s?.connected} metric="connected" points={points} to="/agents?view=connected" color="var(--c-accent)" />
        <Kpi label="Healthy" value={s?.healthy} metric="healthy" points={points} to="/agents?view=healthy" color="var(--c-success)" />
        <Kpi label="Unhealthy" value={s?.unhealthy} metric="unhealthy" points={points} to="/agents?view=unhealthy" color="var(--c-danger)" alarming />
        <Kpi label="Config failed" value={s?.config_failed} metric="config_failed" points={points} to="/agents?view=config_failed" color="var(--c-danger)" alarming />
      </div>

      {waiting.length > 0 && (
        <section className="card border-warning">
          <h2 className="border-b border-border px-4 py-2 font-medium">Bulk pushes waiting on someone ({waiting.length})</h2>
          <ul className="divide-y divide-border">
            {waiting.map((r) => (
              <li key={r.id}>
                <Link to={`/rollouts/${r.id}`} className="flex flex-wrap items-center gap-3 px-4 py-2 hover:bg-hover">
                  <span className="font-medium">
                    {r.config_name} v{r.config_version}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs text-muted">{r.error ?? 'Paused'}</span>
                  <span className="text-xs text-muted">
                    by {r.created_by}, {timeAgo(r.created_at)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <AttentionList
          title="Unhealthy collectors"
          view="unhealthy"
          filter={{ connected: true, healthy: false }}
          reason={(a) => a.health_last_error || a.health_status || 'Reported unhealthy'}
        />
        <AttentionList title="Config failed to apply" view="config_failed" filter={{ configStatus: 'failed' }} reason={(a) => a.remote_config_error || 'The collector rejected the config'} />
      </div>

      <div className={clsx('grid gap-4', can('admin') && 'lg:grid-cols-2')}>
        <section className="card">
          <div className="flex items-center justify-between border-b border-border px-4 py-2">
            <h2 className="font-medium">Recent bulk pushes</h2>
            <Link to="/rollouts" className="text-xs font-medium text-accent hover:underline">
              View all
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="p-4 text-muted">No bulk pushes yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {recent.map((r) => (
                <li key={r.id}>
                  <Link to={`/rollouts/${r.id}`} className="block space-y-1.5 px-4 py-2 hover:bg-hover">
                    <div className="flex items-center gap-3">
                      <RolloutStatusBadge rollout={r} />
                      <span className="font-medium">
                        {r.config_name} v{r.config_version}
                      </span>
                      <span className="flex-1 text-right text-xs text-muted">
                        {r.total_agents.toLocaleString()} collectors · {r.created_by}, {timeAgo(r.created_at)}
                      </span>
                    </div>
                    <ProgressBar rollout={r} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {can('admin') && (
          <section className="card">
            <div className="flex items-center justify-between border-b border-border px-4 py-2">
              <h2 className="font-medium">Alerts in the last 24 hours</h2>
              <Link to="/system" className="text-xs font-medium text-accent hover:underline">
                System
              </Link>
            </div>
            {system.error ? (
              <ErrorNote error={system.error} />
            ) : alerts.length === 0 ? (
              <p className="p-4 text-muted">None.</p>
            ) : (
              <ul className="divide-y divide-border">
                {alerts.map((a, i) => (
                  <li key={i} className="px-4 py-2">
                    <div className="break-words">{a.text}</div>
                    <div className="text-xs text-muted">{timeAgo(a.at)}</div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </div>
  )
}
