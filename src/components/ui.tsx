import { useState } from 'react'
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

/** Page title with a one-line explanation and, on the right, the page's main action. Every list page uses it. */
export function PageHeader({ title, description, action }: { title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-lg font-semibold">{title}</h1>
        {description && <p className="max-w-4xl text-xs text-muted">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 gap-2">{action}</div>}
    </div>
  )
}

/** A secret shown once after it is created, with a copy button. */
export function SecretOnce({ label, secret, extra }: { label: string; secret: string; extra?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(secret)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="space-y-2">
      <p className="font-medium">{label} It will not be shown again.</p>
      <div className="flex items-start gap-2">
        <code className="block min-w-0 flex-1 break-all rounded bg-panel-2 p-2 font-mono text-xs">{secret}</code>
        <button type="button" className="btn btn-sm shrink-0" onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      {extra && <pre className="overflow-auto rounded bg-panel-2 p-2 font-mono text-xs text-muted">{extra}</pre>}
    </div>
  )
}
