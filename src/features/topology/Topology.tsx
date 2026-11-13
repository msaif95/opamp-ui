import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { Network } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type BreakdownRow } from '../../api-client/client'
import { EmptyState } from '../../components/EmptyState'
import { Select } from '../../components/Select'
import { ErrorNote, PageHeader } from '../../components/ui'

/** Attributes that usually describe where a collector runs, offered first. */
const PLACES = ['region', 'cloud.region', 'cloud.provider', 'cloud.availability_zone', 'dc', 'datacenter', 'k8s.cluster.name', 'env', 'deployment.environment', 'team']

const sum = (rows: BreakdownRow[]) =>
  rows.reduce((t, r) => ({ total: t.total + r.total, connected: t.connected + r.connected, healthy: t.healthy + r.healthy, unhealthy: t.unhealthy + r.unhealthy }), {
    total: 0,
    connected: 0,
    healthy: 0,
    unhealthy: 0,
  })

type Counts = ReturnType<typeof sum>

/** Healthy / unhealthy / offline as one bar, with the same information in words for screen readers. */
function HealthBar({ c }: { c: Counts }) {
  const offline = c.total - c.connected
  const other = c.connected - c.healthy - c.unhealthy
  const parts = [
    { n: c.healthy, cls: 'bg-success', label: 'healthy' },
    { n: c.unhealthy, cls: 'bg-danger', label: 'unhealthy' },
    { n: other, cls: 'bg-accent', label: 'connected, health not reported' },
    { n: offline, cls: 'bg-border-strong', label: 'offline' },
  ].filter((p) => p.n > 0)
  return (
    <div className="flex h-1.5 overflow-hidden rounded-full bg-hover" role="img" aria-label={parts.map((p) => `${p.n} ${p.label}`).join(', ')}>
      {parts.map((p) => (
        <div key={p.label} className={p.cls} style={{ width: `${(p.n / Math.max(1, c.total)) * 100}%` }} />
      ))}
    </div>
  )
}

const tone = (c: Counts) => (c.unhealthy > 0 ? 'border-danger/60' : c.connected < c.total ? 'border-warning/60' : 'border-border')
const name = (v: string) => v || 'Not reported'

function Tile({ title, c, to }: { title: string; c: Counts; to: string }) {
  const offline = c.total - c.connected
  return (
    <Link to={to} className={clsx('block rounded-md border bg-panel p-3 transition-colors hover:border-accent', tone(c))}>
      <div className="flex items-baseline justify-between gap-2">
        <span className={clsx('truncate font-medium', !title && 'text-muted')}>{name(title)}</span>
        <span className="shrink-0 text-lg font-semibold tracking-tight">{c.total.toLocaleString()}</span>
      </div>
      <div className="mb-2 mt-0.5 text-xs text-muted">
        {c.unhealthy > 0 && <span className="text-danger">{c.unhealthy.toLocaleString()} unhealthy </span>}
        {offline > 0 && <span>{offline.toLocaleString()} offline </span>}
        {c.unhealthy === 0 && offline === 0 && 'All healthy'}
      </div>
      <HealthBar c={c} />
    </Link>
  )
}

/**
 * The fleet laid out by where collectors run, using the attributes they report (region, data centre, cluster, …).
 * It is a logical map: collectors do not report coordinates, so nothing is drawn on a geographic map.
 */
export function Topology() {
  const [first, setFirst] = useState('')
  const [second, setSecond] = useState('')
  const facets = useQuery({ queryKey: ['agents', 'facets', undefined], queryFn: () => api.facets() })
  const keys = [...(facets.data?.facets ?? []).map((f) => f.key)].sort((a, b) => {
    const rank = (k: string) => (PLACES.includes(k) ? PLACES.indexOf(k) : PLACES.length)
    return rank(a) - rank(b) || a.localeCompare(b)
  })
  // Until the user chooses, group by the most place-like attribute the fleet reports.
  const by = first || keys[0] || ''
  const then = second && second !== by ? second : ''
  const breakdown = useQuery({
    queryKey: ['agents', 'breakdown', by, then],
    queryFn: () => api.breakdown(then ? [by, then] : [by]),
    enabled: by !== '',
    refetchInterval: 30_000,
  })

  const rows = breakdown.data?.rows ?? []
  const groups = [...new Set(rows.map((r) => r.values[0]))].map((value) => ({ value, rows: rows.filter((r) => r.values[0] === value) }))
  const link = (...pairs: [string, string][]) => `/agents?${new URLSearchParams(pairs.filter(([, v]) => v).map(([k, v]) => ['attr', `${k}=${v}`]))}`
  const options = keys.map((k) => ({ value: k, label: k }))

  return (
    <div className="space-y-4">
      <PageHeader
        title="Topology"
        description="The fleet grouped by the attributes collectors report, such as region, data centre or cluster. Each tile opens the matching collectors."
      />
      {facets.error ? (
        <ErrorNote error={facets.error} />
      ) : facets.data && keys.length === 0 ? (
        <EmptyState icon={Network} title="Nothing to lay out yet">
          <p>
            The topology is built from attributes shared by several collectors, such as <code className="font-mono">region</code> or{' '}
            <code className="font-mono">env</code>. Add them as labels when installing collectors (Fleet → Add collectors).
          </p>
        </EmptyState>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <label className="space-y-1">
              <span className="block text-xs text-muted">Group by</span>
              <Select className="w-56" value={by} onChange={setFirst} options={options} aria-label="Group by" />
            </label>
            <label className="space-y-1">
              <span className="block text-xs text-muted">Then by</span>
              <Select
                className="w-56"
                value={then}
                onChange={setSecond}
                options={[{ value: '', label: 'Nothing' }, ...options.filter((o) => o.value !== by)]}
                aria-label="Then by"
              />
            </label>
            <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
              {[
                ['bg-success', 'Healthy'],
                ['bg-danger', 'Unhealthy'],
                ['bg-border-strong', 'Offline'],
              ].map(([cls, label]) => (
                <span key={label} className="inline-flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${cls}`} /> {label}
                </span>
              ))}
            </div>
          </div>

          {breakdown.error ? (
            <ErrorNote error={breakdown.error} />
          ) : then ? (
            <div className="space-y-4">
              {groups.map((g) => {
                const c = sum(g.rows)
                return (
                  <section key={g.value} className={clsx('card p-4', tone(c))}>
                    <div className="mb-3 flex flex-wrap items-baseline gap-x-3">
                      <h2 className="font-medium">
                        <span className="text-muted">{by}:</span>{' '}
                        <Link to={link([by, g.value])} className="hover:underline">
                          {name(g.value)}
                        </Link>
                      </h2>
                      <span className="text-xs text-muted">
                        {c.total.toLocaleString()} {c.total === 1 ? 'collector' : 'collectors'} · {c.unhealthy.toLocaleString()} unhealthy · {(c.total - c.connected).toLocaleString()} offline
                      </span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
                      {g.rows.map((r) => (
                        <Tile key={r.values[1]} title={r.values[1]} c={sum([r])} to={link([by, g.value], [then, r.values[1]])} />
                      ))}
                    </div>
                  </section>
                )
              })}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
              {groups.map((g) => (
                <Tile key={g.value} title={g.value} c={sum(g.rows)} to={link([by, g.value])} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
