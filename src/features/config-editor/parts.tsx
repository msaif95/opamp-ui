import clsx from 'clsx'
import type { ConfigTemplate, Issue } from '../../api-client/client'
import { Badge } from '../../components/ui'
import { diffLines } from '../../lib/diff'

export function OriginBadge({ origin }: { origin: ConfigTemplate['origin'] }) {
  return origin === 'git' ? <Badge tone="info">Git</Badge> : <Badge tone="neutral">UI</Badge>
}

export function IssueList({ issues }: { issues: Issue[] }) {
  if (issues.length === 0) return null
  return (
    <ul className="space-y-1 text-xs">
      {issues.map((i, n) => (
        <li key={n} className={i.severity === 'error' ? 'text-danger' : 'text-warning'}>
          <span className="font-medium capitalize">{i.severity}</span>
          {i.path && <span className="font-mono"> {i.path}</span>}: {i.message}
        </li>
      ))}
    </ul>
  )
}

export function YamlEditor({ value, onChange, readOnly }: { value: string; onChange: (v: string) => void; readOnly?: boolean }) {
  return (
    <textarea
      className="block h-[28rem] w-full resize-y bg-transparent p-4 font-mono text-xs leading-5 outline-none"
      spellCheck={false}
      value={value}
      readOnly={readOnly}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Config YAML"
    />
  )
}

export function DiffView({ before, after }: { before: string; after: string }) {
  const lines = diffLines(before, after)
  if (lines.every((l) => l.type === 'same')) return <p className="p-4 text-muted">No differences.</p>
  return (
    <pre className="overflow-auto py-2 font-mono text-xs leading-5">
      {lines.map((l, n) => (
        <div key={n} className={clsx('px-4', l.type === 'add' && 'bg-success/15 text-success', l.type === 'del' && 'bg-danger/15 text-danger')}>
          {l.type === 'add' ? '+ ' : l.type === 'del' ? '- ' : '  '}
          {l.text}
        </div>
      ))}
    </pre>
  )
}
