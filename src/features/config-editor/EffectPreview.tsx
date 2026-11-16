import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { ArrowRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api, type PreviewRecord, type PreviewStep } from '../../api-client/client'
import { Select } from '../../components/Select'
import { Badge, ErrorNote } from '../../components/ui'
import { attributeChanges } from '../../lib/preview'

const STATUS: Record<PreviewStep['status'], { label: string; tone: 'success' | 'warning' | 'neutral' | 'info' }> = {
  applied: { label: 'Previewed', tone: 'success' },
  approximate: { label: 'Approximate', tone: 'info' },
  passthrough: { label: 'No effect on data', tone: 'neutral' },
  not_previewed: { label: 'Not previewed', tone: 'warning' },
}
const NOUN = { logs: ['log record', 'log records'], traces: ['span', 'spans'], metrics: ['data point', 'data points'] }

function Steps({ steps }: { steps: PreviewStep[] }) {
  if (steps.length === 0) return <p className="px-4 py-3 text-muted">This pipeline has no processors: everything passes through as it arrives.</p>
  return (
    <ol className="divide-y divide-border">
      {steps.map((s, i) => (
        <li key={i} className="flex flex-wrap items-start gap-x-3 gap-y-1 px-4 py-2.5">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent">{i + 1}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-medium">{s.id}</span>
              <Badge tone={STATUS[s.status].tone}>{STATUS[s.status].label}</Badge>
              <span className="inline-flex items-center gap-1 text-xs text-muted">
                {s.in.toLocaleString()} in <ArrowRight size={11} aria-hidden /> {s.out.toLocaleString()} out
                {s.dropped > 0 && <span className="text-danger">· {s.dropped.toLocaleString()} dropped</span>}
                {s.changed > 0 && <span>· {s.changed.toLocaleString()} changed</span>}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted">{s.note}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}

function Changes({ record, all }: { record: PreviewRecord; all: boolean }) {
  // A dropped record is compared with itself, so its attributes can still be shown on request.
  const changes = attributeChanges(record.before, record.after ?? record.before).filter((c) => all || c.kind !== 'same')
  if (changes.length === 0) return <span className="text-muted">–</span>
  return (
    <ul className="space-y-0.5 font-mono text-xs">
      {changes.map((c) => (
        <li
          key={`${c.scope}.${c.key}`}
          className={clsx('break-all rounded px-1', c.kind === 'added' && 'bg-success/15 text-success', c.kind === 'removed' && 'bg-danger/15 text-danger', c.kind === 'changed' && 'bg-warning/15 text-warning', c.kind === 'same' && 'text-muted')}
        >
          <span className="select-none">{c.kind === 'added' ? '+ ' : c.kind === 'removed' ? '- ' : c.kind === 'changed' ? '~ ' : '  '}</span>
          {c.scope === 'resource' && <span className="opacity-80">resource.</span>}
          {c.key}
          {c.kind === 'changed' ? `: ${c.before} → ${c.after}` : ` = ${c.kind === 'removed' ? c.before : c.after}`}
          <span className="sr-only"> ({c.kind})</span>
        </li>
      ))}
    </ul>
  )
}

/**
 * Shows what a config's processors would do to sample telemetry before it is pushed: each processor in order with
 * what it dropped or changed, then every sample record before and after. The backend models the common processors
 * and says which ones it cannot; nothing is sent to any collector.
 */
export function EffectPreview({ body }: { body: string }) {
  // The config may be changing as it is edited; preview what it settles on.
  const [settled, setSettled] = useState(body)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(body), 400)
    return () => clearTimeout(timer)
  }, [body])
  const [signal, setSignal] = useState('')
  const [pipeline, setPipeline] = useState('')
  const [own, setOwn] = useState(false)
  const [draft, setDraft] = useState('')
  // The pasted sample is only used once "Preview with this data" is pressed, not on every keystroke.
  const [sample, setSample] = useState('')
  const [all, setAll] = useState(false)

  const preview = useQuery({
    queryKey: ['config-preview', settled, signal, pipeline, own ? sample : ''],
    queryFn: () => api.previewConfig({ body: settled, signal, pipeline, sample: own ? sample : '' }),
    enabled: settled.trim() !== '' && (!own || sample !== ''),
    placeholderData: keepPreviousData,
    retry: false,
    staleTime: 60_000,
  })
  const builtIn = useMutation({ mutationFn: api.previewSamples, onSuccess: (s) => setDraft(s[(preview.data?.signal ?? 'logs') as keyof typeof s]) })
  const p = preview.data
  const noun = NOUN[p?.signal ?? 'logs']
  const dropped = p ? p.in - p.out : 0
  const changed = p ? p.records.filter((r) => r.after && r.changed_by.length > 0).length : 0

  return (
    <div className="space-y-3 p-4">
      <p className="max-w-4xl text-xs text-muted">
        What this config's processors would do to telemetry, worked out here on sample data. Nothing is sent to a collector. The console models the common
        processors itself, so treat this as a check of your intent, not a guarantee of what a collector does.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {p && (
          <div className="seg" role="group" aria-label="Signal">
            {p.signals.map((s) => (
              <button
                key={s}
                className={p.signal === s ? 'active capitalize' : 'capitalize'}
                onClick={() => {
                  setSignal(s)
                  setPipeline('')
                  // A pasted sample belongs to one signal.
                  setOwn(false)
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {p && p.pipelines.length > 1 && (
          <Select className="w-48" aria-label="Pipeline" value={p.pipeline} onChange={setPipeline} options={p.pipelines.map((name) => ({ value: name, label: `Pipeline ${name}` }))} />
        )}
        <div className="seg ml-auto" role="group" aria-label="Sample data">
          <button className={own ? '' : 'active'} onClick={() => setOwn(false)}>
            Built-in sample
          </button>
          <button className={own ? 'active' : ''} onClick={() => setOwn(true)}>
            My own data
          </button>
        </div>
      </div>

      {own && (
        <div className="space-y-2 rounded-md border border-border p-3">
          <label className="block space-y-1">
            <span className="block text-xs text-muted">
              Paste {p?.signal ?? 'telemetry'} as OTLP JSON (what the collector's file exporter writes, or an OTLP/HTTP JSON request body). Up to 200 records are
              previewed.
            </span>
            <textarea
              className="block h-48 w-full resize-y rounded-md border border-border bg-transparent p-3 font-mono text-xs leading-5 outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              spellCheck={false}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              aria-label="Sample telemetry as OTLP JSON"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn btn-primary btn-sm" disabled={draft.trim() === ''} onClick={() => setSample(draft)}>
              Preview with this data
            </button>
            <button className="btn btn-sm" disabled={builtIn.isPending} onClick={() => builtIn.mutate()}>
              Start from the built-in sample
            </button>
            {builtIn.error && <span className="text-xs text-danger">{builtIn.error.message}</span>}
          </div>
        </div>
      )}

      {preview.error && <ErrorNote error={preview.error} />}
      {!p && !preview.error && <p className="text-muted">{own && sample === '' ? 'Paste a sample and press "Preview with this data".' : 'Working it out…'}</p>}
      {p && !preview.error && (
        <div className={clsx('space-y-3', preview.isPlaceholderData && 'opacity-60')} aria-busy={preview.isFetching}>
          {!p.exact && (
            <p className="card border-warning p-3 text-xs">
              This preview is partial. {p.steps.some((s) => s.status === 'not_previewed') && 'Processors marked "Not previewed" are shown as letting everything through unchanged, which may not be what they do. '}
              {p.steps.some((s) => s.status === 'approximate') && 'For the sampler, the share kept is right but which records are kept is only an illustration.'}
            </p>
          )}
          <section className="rounded-md border border-border">
            <h3 className="border-b border-border px-4 py-2 text-xs font-medium">
              Processors of pipeline <span className="font-mono">{p.pipeline}</span>, in order
            </h3>
            <Steps steps={p.steps} />
          </section>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs" role="status">
              <span className="font-medium">
                {p.in.toLocaleString()} {noun[p.in === 1 ? 0 : 1]} in, {p.out.toLocaleString()} out.
              </span>{' '}
              <span className="text-muted">
                {dropped.toLocaleString()} dropped, {changed.toLocaleString()} changed, {(p.out - changed).toLocaleString()} untouched.
                {p.left_out > 0 && ` ${p.left_out.toLocaleString()} more in the sample were left out.`}
              </span>
            </p>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" className="accent-[var(--c-accent)]" checked={all} onChange={(e) => setAll(e.target.checked)} />
              Show every attribute
            </label>
          </div>
          <div className="overflow-auto rounded-md border border-border">
            <table className="table">
              <thead>
                <tr>
                  <th className="w-[32%]">{noun[0].charAt(0).toUpperCase() + noun[0].slice(1)}</th>
                  <th className="w-44">Result</th>
                  <th>{all ? 'Attributes after the pipeline' : 'What changed'}</th>
                </tr>
              </thead>
              <tbody>
                {p.records.map((r, i) => (
                  <tr key={i} className={r.after ? undefined : 'opacity-70'}>
                    <td className="align-top">
                      <div className={clsx('break-words', !r.after && 'line-through')}>{r.title || <span className="text-muted">(empty)</span>}</div>
                      <div className="text-xs text-muted">
                        {[r.detail, r.before.resource['service.name']].filter(Boolean).join(' · ')}
                      </div>
                    </td>
                    <td className="align-top">
                      {!r.after ? (
                        <>
                          <Badge tone="danger">Dropped</Badge>
                          <div className="mt-0.5 text-xs text-muted">
                            by <span className="font-mono">{r.dropped_by}</span>
                          </div>
                        </>
                      ) : r.changed_by.length > 0 ? (
                        <>
                          <Badge tone="info">Changed</Badge>
                          <div className="mt-0.5 text-xs text-muted">
                            by <span className="font-mono">{r.changed_by.join(', ')}</span>
                          </div>
                        </>
                      ) : (
                        <Badge tone="neutral">Unchanged</Badge>
                      )}
                    </td>
                    <td className="align-top">
                      <Changes record={r} all={all} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
