import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../api-client/client'
import { useAuth } from '../../auth/AuthProvider'
import { Badge, ErrorNote } from '../../components/ui'
import { timeAgo } from '../../lib/time'
import { ProgressBar, RolloutStatusBadge, SelectorChips } from './parts'

export function RolloutDetail() {
  const { id = '' } = useParams()
  const qc = useQueryClient()
  const { can } = useAuth()

  const { data, error } = useQuery({
    queryKey: ['rollouts', id],
    queryFn: () => api.rollout(id),
    refetchInterval: (q) => {
      const r = q.state.data?.rollout
      const inFlight = (r?.counts.offered ?? 0) + (r?.counts.applying ?? 0) > 0
      return r?.status === 'running' || inFlight ? 2000 : false
    },
  })
  const act = useMutation({
    mutationFn: (action: 'pause' | 'resume' | 'abort') => api.rolloutAction(id, action),
    onSettled: () => qc.invalidateQueries({ queryKey: ['rollouts'] }),
  })

  if (error) return <ErrorNote error={error} />
  if (!data) return <p className="text-muted">Loading…</p>
  const r = data.rollout
  const active = r.status === 'running' || r.status === 'paused'

  return (
    <div className="space-y-4">
      <Link to="/rollouts" className="inline-flex items-center gap-1 text-xs text-muted hover:text-fg">
        <ArrowLeft size={13} /> Bulk push
      </Link>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold">
              <Link to={`/configs/${r.config_id}`} className="hover:underline">
                {r.config_name} v{r.config_version}
              </Link>
            </h1>
            <RolloutStatusBadge rollout={r} />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <SelectorChips selector={r.selector} />
            <span>
              · started by {r.created_by} {timeAgo(r.created_at)}
            </span>
          </div>
        </div>
        {can('operator') && active && (
          <div className="flex gap-2">
            {r.status === 'running' ? (
              <button className="btn" disabled={act.isPending} onClick={() => act.mutate('pause')}>
                Pause
              </button>
            ) : (
              <button
                className="btn btn-primary"
                disabled={act.isPending}
                onClick={() => {
                  if (confirm('Resume and continue with the next batch? Failures so far will no longer count toward the limit.')) act.mutate('resume')
                }}
              >
                Resume
              </button>
            )}
            <button
              className="btn btn-danger"
              disabled={act.isPending}
              onClick={() => {
                if (confirm('Abort this push? Agents not yet reached keep their current config. Agents already updated are not rolled back.'))
                  act.mutate('abort')
              }}
            >
              Abort
            </button>
          </div>
        )}
      </div>
      {act.error && <p className="text-xs text-danger">{act.error.message}</p>}
      {r.status === 'paused' && r.error && <p className="card border-warning p-3 text-warning">{r.error}</p>}

      <section className="card space-y-3 p-4">
        <div className="flex flex-wrap justify-between gap-2 text-xs text-muted">
          <span>
            Batch {r.batches_released} of {r.total_batches} · {r.batch_size} agents per batch · pauses above {r.max_failure_pct}% failures per batch
          </span>
          <span>{r.total_agents.toLocaleString()} agents targeted</span>
        </div>
        <ProgressBar rollout={r} legend />
      </section>

      <section className="card overflow-auto">
        <h2 className="border-b border-border px-4 py-2 font-medium">Failed and skipped agents</h2>
        {data.problems.length === 0 ? (
          <p className="p-4 text-muted">None.</p>
        ) : (
          <table className="table dense">
            <thead>
              <tr>
                <th>Agent</th>
                <th>Batch</th>
                <th>Result</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {data.problems.map((p) => (
                <tr key={p.instance_uid}>
                  <td>
                    <Link to={`/agents/${p.instance_uid}`} className="font-mono text-xs text-accent hover:underline">
                      {p.host_name || p.instance_uid}
                    </Link>
                  </td>
                  <td>{p.batch}</td>
                  <td>{p.status === 'failed' ? <Badge tone="danger">Failed</Badge> : <Badge tone="neutral">Skipped</Badge>}</td>
                  <td>{p.error}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
