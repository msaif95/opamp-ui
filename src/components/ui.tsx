import clsx from 'clsx'
import type { ReactNode } from 'react'
import type { Agent } from '../api-client/client'

const tones = {
  success: 'bg-success/15 text-success',
  danger: 'bg-danger/15 text-danger',
  warning: 'bg-warning/15 text-warning',
  neutral: 'bg-hover text-muted',
  info: 'bg-accent-soft text-accent',
}

export function Badge({ tone, children }: { tone: keyof typeof tones; children: ReactNode }) {
  return <span className={clsx('badge', tones[tone])}>{children}</span>
}

export function AgentStatus({ agent }: { agent: Pick<Agent, 'connected' | 'healthy' | 'paused'> }) {
  if (!agent.connected) return <Badge tone="neutral">Offline</Badge>
  if (agent.paused) return <Badge tone="warning">Paused</Badge>
  if (agent.healthy === false) return <Badge tone="danger">Unhealthy</Badge>
  if (agent.healthy === null) return <Badge tone="info">Connected</Badge>
  return <Badge tone="success">Healthy</Badge>
}

export function ConfigStatus({ status }: { status: Agent['remote_config_status'] }) {
  const tone = { unset: 'neutral', applied: 'success', applying: 'warning', failed: 'danger' } as const
  const label = { unset: 'None', applied: 'Applied', applying: 'Applying', failed: 'Failed' }
  return <Badge tone={tone[status]}>{label[status]}</Badge>
}

export function ErrorNote({ error }: { error: unknown }) {
  return <p className="p-4 text-danger">{error instanceof Error ? error.message : 'Something went wrong'}</p>
}
