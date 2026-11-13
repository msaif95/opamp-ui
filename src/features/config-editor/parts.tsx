import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { useId, useRef, useState } from 'react'
import { api, type ConfigTemplate, type Issue } from '../../api-client/client'
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

/** The partly typed secret reference that ends at the caret, e.g. "${secret:ven", or null. */
const openReference = (before: string) => /\$\{secret:([A-Za-z0-9_.-]*)$/.exec(before)
const references = (text: string) => [...text.matchAll(/\$\{secret:([A-Za-z0-9_.-]+)\}/g)].map((m) => m[1])

/**
 * The YAML editor. When `project` is given (null: outside any project) it knows that project's secrets: typing
 * "${secret:" offers their names (arrow keys, then Enter or Tab), "Insert secret" adds a reference at the caret,
 * and references to secrets that do not exist are pointed out.
 */
export function YamlEditor({ value, onChange, readOnly, project }: { value: string; onChange: (v: string) => void; readOnly?: boolean; project?: string | null }) {
  const area = useRef<HTMLTextAreaElement>(null)
  const listId = useId()
  // Offered names, the text to replace (from..caret) and which name is highlighted; null when nothing is offered.
  const [offer, setOffer] = useState<{ names: string[]; from: number; active: number } | null>(null)
  const secrets = useQuery({
    queryKey: ['secret-names', project ?? 'none'],
    queryFn: () => api.secretNames(project ?? null),
    enabled: project !== undefined && !readOnly,
    retry: false,
  })
  const names = secrets.data?.names
  const unknown = names ? [...new Set(references(value))].filter((n) => !names.includes(n)) : []

  const lookForReference = (text: string, caret: number) => {
    const match = names && openReference(text.slice(0, caret))
    const matching = match ? names.filter((n) => n.toLowerCase().startsWith(match[1].toLowerCase())) : []
    setOffer(match && matching.length > 0 ? { names: matching, from: caret - match[1].length, active: 0 } : null)
  }
  /** Replaces value[from..to] with text and puts the caret after it. */
  const splice = (from: number, to: number, text: string) => {
    onChange(value.slice(0, from) + text + value.slice(to))
    setOffer(null)
    requestAnimationFrame(() => {
      area.current?.focus()
      area.current?.setSelectionRange(from + text.length, from + text.length)
    })
  }
  const accept = (name: string) => {
    const caret = area.current?.selectionStart ?? value.length
    // Close the reference unless a closing brace is already there.
    splice(offer!.from, caret, name + (value[caret] === '}' ? '' : '}'))
  }

  return (
    <div className="relative">
      {names && names.length > 0 && !readOnly && (
        <div className="flex items-center justify-end gap-2 border-b border-border px-3 py-1.5 text-xs text-muted">
          <span>
            Type <code className="font-mono">{'${secret:'}</code> for suggestions, or
          </span>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger className="btn btn-sm">Insert secret</DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content align="end" sideOffset={4} className="z-50 max-h-72 min-w-48 overflow-auto rounded-md border border-border bg-panel p-1 shadow-lg">
                {names.map((n) => (
                  <DropdownMenu.Item
                    key={n}
                    className="cursor-default select-none rounded px-2 py-1.5 font-mono text-xs outline-none data-[highlighted]:bg-accent-soft data-[highlighted]:text-accent"
                    onSelect={() => {
                      const at = area.current?.selectionStart ?? value.length
                      splice(at, area.current?.selectionEnd ?? at, `\${secret:${n}}`)
                    }}
                  >
                    {n}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      )}
      <textarea
        ref={area}
        className="block h-[28rem] w-full resize-y bg-transparent p-4 font-mono text-xs leading-5 outline-none"
        spellCheck={false}
        value={value}
        readOnly={readOnly}
        onChange={(e) => {
          onChange(e.target.value)
          lookForReference(e.target.value, e.target.selectionStart)
        }}
        onClick={(e) => lookForReference(value, e.currentTarget.selectionStart)}
        onBlur={() => setTimeout(() => setOffer(null), 150)}
        onKeyDown={(e) => {
          if (!offer) return
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            setOffer({ ...offer, active: (offer.active + (e.key === 'ArrowDown' ? 1 : offer.names.length - 1)) % offer.names.length })
          } else if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault()
            accept(offer.names[offer.active])
          } else if (e.key === 'Escape') {
            e.preventDefault()
            setOffer(null)
          }
        }}
        aria-label="Config YAML"
        aria-autocomplete={names ? 'list' : undefined}
        aria-controls={offer ? listId : undefined}
        aria-activedescendant={offer ? `${listId}-${offer.active}` : undefined}
      />
      {offer && (
        <div className="absolute bottom-3 left-3 z-10 w-72 rounded-md border border-border bg-panel shadow-lg">
          <div className="border-b border-border px-2 py-1 text-[11px] text-muted">Secrets · ↑ ↓ to choose, Enter to insert, Esc to dismiss</div>
          <ul id={listId} role="listbox" aria-label="Secrets" className="max-h-48 overflow-auto p-1">
            {offer.names.map((n, i) => (
              <li
                key={n}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === offer.active}
                className={clsx('cursor-pointer rounded px-2 py-1 font-mono text-xs', i === offer.active && 'bg-accent-soft text-accent')}
                onMouseDown={(e) => {
                  e.preventDefault()
                  accept(n)
                }}
              >
                {n}
              </li>
            ))}
          </ul>
        </div>
      )}
      {unknown.length > 0 && (
        <p className="border-t border-border px-4 py-2 text-xs text-warning">
          {unknown.length === 1 ? 'This secret does not exist' : 'These secrets do not exist'} in this config's project:{' '}
          <span className="font-mono">{unknown.join(', ')}</span>. A config that refers to a missing secret is not sent to collectors. An
          administrator can add it under Agent credentials → Config secrets.
        </p>
      )}
    </div>
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
