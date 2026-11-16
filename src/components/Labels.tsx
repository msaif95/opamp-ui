import { Plus, X } from 'lucide-react'
import { useState } from 'react'
import { MAX_LABELS, readKeys, readLabels } from '../lib/labels'
import type { LabelChange } from '../api-client/client'
import { ErrorNote } from './ui'

/** Labels as chips. With `onPick`, each is a button (used on the fleet page to filter by it). */
export function LabelChips({ labels, onPick, max }: { labels: Record<string, string>; onPick?: (key: string, value: string) => void; max?: number }) {
  const all = Object.entries(labels).sort(([a], [b]) => a.localeCompare(b))
  const shown = max ? all.slice(0, max) : all
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {shown.map(([k, v]) =>
        onPick ? (
          <button key={k} type="button" className="chip h-5 font-mono text-[11px] hover:border-accent hover:text-accent" title={`Show collectors labelled ${k}=${v}`} onClick={() => onPick(k, v)}>
            {k}={v}
          </button>
        ) : (
          <span key={k} className="chip h-5 font-mono text-[11px]">
            {k}={v}
          </span>
        ),
      )}
      {all.length > shown.length && <span className="text-xs text-muted">+{all.length - shown.length}</span>}
    </span>
  )
}

/**
 * The form inside a labels dialog. With `initial` it edits one collector's whole set of labels; without, it
 * describes a change for several collectors: labels to add or overwrite, and names to take off.
 */
export function LabelForm({
  initial,
  pending,
  error,
  onCancel,
  onSubmit,
}: {
  initial?: Record<string, string>
  pending: boolean
  error: unknown
  onCancel: () => void
  onSubmit: (change: LabelChange) => void
}) {
  const [rows, setRows] = useState(() => {
    const start = Object.entries(initial ?? {})
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => ({ key, value }))
    return start.length > 0 ? start : [{ key: '', value: '' }]
  })
  const [removeText, setRemoveText] = useState('')
  const [problem, setProblem] = useState('')
  const whole = initial !== undefined
  const edit = (i: number, change: Partial<{ key: string; value: string }>) => setRows(rows.map((r, n) => (n === i ? { ...r, ...change } : r)))

  return (
    <form
      className="mt-4 space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        const read = readLabels(rows)
        if ('error' in read) return setProblem(read.error)
        const remove = whole ? [] : readKeys(removeText)
        const both = remove.find((k) => k in read.labels)
        if (both) return setProblem(`"${both}" is both set and removed.`)
        if (!whole && remove.length === 0 && Object.keys(read.labels).length === 0) return setProblem('Add a label to set, or name one to remove.')
        setProblem('')
        onSubmit({ set: read.labels, remove })
      }}
    >
      <fieldset className="space-y-2">
        <legend className="mb-1 text-xs font-medium">{whole ? 'Labels' : 'Add or change'}</legend>
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            <input className="input w-44 font-mono text-xs" placeholder="name, e.g. owner" aria-label={`Label ${i + 1} name`} value={r.key} onChange={(e) => edit(i, { key: e.target.value })} />
            <span className="text-muted">=</span>
            <input className="input min-w-0 flex-1 font-mono text-xs" placeholder="value, e.g. alice" aria-label={`Label ${i + 1} value`} value={r.value} onChange={(e) => edit(i, { value: e.target.value })} />
            <button type="button" className="btn btn-ghost btn-sm" aria-label={`Remove label ${i + 1}`} onClick={() => setRows(rows.length > 1 ? rows.filter((_, n) => n !== i) : [{ key: '', value: '' }])}>
              <X size={13} />
            </button>
          </div>
        ))}
        <button type="button" className="btn btn-sm" disabled={rows.length >= MAX_LABELS} onClick={() => setRows([...rows, { key: '', value: '' }])}>
          <Plus size={12} /> Add label
        </button>
      </fieldset>
      {!whole && (
        <label className="block space-y-1">
          <span className="block text-xs font-medium">Remove</span>
          <input className="input w-full font-mono text-xs" placeholder="names to take off, separated by commas" value={removeText} onChange={(e) => setRemoveText(e.target.value)} />
        </label>
      )}
      {problem && <p className="text-xs text-danger">{problem}</p>}
      {Boolean(error) && <ErrorNote error={error} />}
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? 'Saving…' : whole ? 'Save labels' : 'Apply'}
        </button>
      </div>
    </form>
  )
}
