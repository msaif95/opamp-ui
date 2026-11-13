import type { Rollout, RolloutAgentStatus, Selector } from '../../api-client/client'
import { Badge } from '../../components/ui'

const statusTone = {
  pending: 'neutral',
  running: 'info',
  paused: 'warning',
  completed: 'success',
  failed: 'danger',
  rolled_back: 'warning',
  aborted: 'neutral',
} as const

export function RolloutStatusBadge({ rollout }: { rollout: Rollout }) {
  const withFailures = rollout.status === 'completed' && (rollout.counts.failed ?? 0) > 0
  return (
    <Badge tone={withFailures ? 'warning' : statusTone[rollout.status]}>
      <span className="first-letter:uppercase">{rollout.status.replace('_', ' ') + (withFailures ? ' with failures' : '')}</span>
    </Badge>
  )
}

export function SelectorChips({ selector }: { selector: Selector }) {
  const entries = Object.entries(selector)
  if (entries.length === 0) return <span className="chip">All agents</span>
  return (
    <span className="inline-flex flex-wrap gap-1">
      {entries.map(([k, vals]) => (
        <span key={k} className="chip">
          {k}: {vals.join(' or ')}
        </span>
      ))}
    </span>
  )
}

const segments: { status: RolloutAgentStatus; label: string; bar: string }[] = [
  { status: 'applied', label: 'Applied', bar: 'bg-success' },
  { status: 'failed', label: 'Failed', bar: 'bg-danger' },
  { status: 'applying', label: 'Applying', bar: 'bg-warning' },
  { status: 'offered', label: 'Sent', bar: 'bg-accent' },
  { status: 'skipped', label: 'Skipped', bar: 'bg-faint' },
  { status: 'pending', label: 'Waiting', bar: 'bg-border-strong' },
]

export function ProgressBar({ rollout, legend }: { rollout: Rollout; legend?: boolean }) {
  const total = Math.max(1, rollout.total_agents)
  return (
    <div className="space-y-2">
      <div className="flex h-2 overflow-hidden rounded-full bg-hover">
        {segments.map((s) => {
          const n = rollout.counts[s.status] ?? 0
          return n > 0 && <div key={s.status} className={s.bar} style={{ width: `${(n / total) * 100}%` }} title={`${s.label}: ${n}`} />
        })}
      </div>
      {legend && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          {segments.map((s) => (
            <span key={s.status} className="inline-flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${s.bar}`} />
              {s.label} {(rollout.counts[s.status] ?? 0).toLocaleString()}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
