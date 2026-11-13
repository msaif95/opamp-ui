import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { api, type Rollout, type RolloutBatch } from '../../api-client/client'
import { ErrorNote } from '../../components/ui'
import { useNow } from '../../lib/time'

const clock = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

function duration(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`
}

function outcome(b: RolloutBatch) {
  const n = (k: keyof RolloutBatch['counts']) => b.counts[k] ?? 0
  const parts = [
    n('applied') && `${n('applied')} applied`,
    n('failed') && `${n('failed')} failed`,
    n('rolled_back') && `${n('rolled_back')} rolled back`,
    n('skipped') && `${n('skipped')} skipped`,
    n('offered') + n('applying') && `${n('offered') + n('applying')} in progress`,
    n('pending') && `${n('pending')} waiting`,
  ].filter(Boolean)
  const bar = !b.started_at
    ? 'border border-dashed border-border-strong bg-transparent'
    : !b.finished_at
      ? 'bg-accent animate-pulse'
      : n('failed') > 0
        ? 'bg-danger'
        : n('rolled_back') > 0
          ? 'bg-warning'
          : 'bg-success'
  return { text: parts.join(', '), bar }
}

/**
 * A bulk push as a timeline: one bar per batch from when its first collector was offered the config to when its
 * last one settled. Gaps between bars are time spent waiting, for approval or for someone to resume.
 */
export function RolloutTimeline({ rollout }: { rollout: Rollout }) {
  const running = rollout.status === 'running' || rollout.status === 'paused'
  const { data, error } = useQuery({
    queryKey: ['rollouts', rollout.id, 'batches', rollout.status, rollout.batches_released],
    queryFn: () => api.rolloutBatches(rollout.id),
    refetchInterval: running ? 3000 : false,
  })
  const now = useNow(1000)
  if (error) return <ErrorNote error={error} />
  const batches = data?.batches ?? []
  if (batches.length === 0) return null

  const start = new Date(rollout.created_at).getTime()
  const ends = batches.flatMap((b) => [b.started_at, b.finished_at]).filter((t): t is string => t !== null).map((t) => new Date(t).getTime())
  const end = Math.max(start + 1000, running ? now : rollout.finished_at ? new Date(rollout.finished_at).getTime() : 0, ...ends)
  const pct = (t: number) => ((t - start) / (end - start)) * 100

  return (
    <section className="card p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-medium">Timeline</h2>
        <span className="text-xs text-muted">
          {clock(start)} to {running ? 'now' : clock(end)} · {duration(end - start)} {running ? 'so far' : 'in total'}
        </span>
      </div>
      <ol className="space-y-2">
        {batches.map((b) => {
          const from = b.started_at ? new Date(b.started_at).getTime() : null
          const to = b.finished_at ? new Date(b.finished_at).getTime() : from !== null ? end : null
          const { text, bar } = outcome(b)
          const timing = from === null ? 'not released yet' : `${clock(from)}, ${b.finished_at ? `took ${duration(to! - from)}` : `running for ${duration(end - from)}`}`
          return (
            <li key={b.number} className="grid grid-cols-[7rem_1fr] items-center gap-x-3 sm:grid-cols-[7rem_1fr_16rem]">
              <div className="text-xs">
                <div className="font-medium">Batch {b.number}</div>
                <div className="text-muted">{b.agents.toLocaleString()} collectors</div>
              </div>
              <div className="relative h-5 rounded bg-hover" aria-hidden>
                <div
                  className={clsx('absolute inset-y-0 rounded', bar)}
                  style={from === null ? { left: `${Math.min(98, pct(end))}%`, right: 0 } : { left: `${pct(from)}%`, width: `max(${pct(to!) - pct(from)}%, 4px)` }}
                />
              </div>
              <div className="col-span-2 text-xs text-muted sm:col-span-1">
                {timing}
                {text && ` · ${text}`}
              </div>
            </li>
          )
        })}
      </ol>
      <p className="mt-3 text-xs text-muted">
        Bars run from the first collector being offered the config to the last one settling. Gaps are time spent waiting for approval or for
        someone to resume.
      </p>
    </section>
  )
}
