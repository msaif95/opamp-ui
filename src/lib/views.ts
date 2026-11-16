import type { AgentQuery } from '../api-client/client'

/** The fleet page's filters, as kept in the address and in saved views. */
export interface FleetFilters {
  /** all, connected, offline, healthy, unhealthy, config_failed or removed. */
  view: string
  project: string
  group: string
  q: string
  attrs: Record<string, string>
}

export const NO_FILTERS: FleetFilters = { view: 'all', project: '', group: '', q: '', attrs: {} }

/** A fleet view someone saved under a name; `query` is what follows /agents? to open it. */
export interface SavedView {
  id: string
  name: string
  query: string
}

/** Filters as the query string the fleet page reads: ?view=&project=&group=&q=&attr=k=v. */
export function encodeFilters(f: FleetFilters): string {
  const p = new URLSearchParams()
  if (f.view && f.view !== 'all') p.set('view', f.view)
  if (f.project) p.set('project', f.project)
  if (f.group) p.set('group', f.group)
  if (f.q.trim()) p.set('q', f.q.trim())
  for (const k of Object.keys(f.attrs).sort()) p.append('attr', `${k}=${f.attrs[k]}`)
  return p.toString()
}

export function decodeFilters(query: string): FleetFilters {
  const p = new URLSearchParams(query)
  const attrs: Record<string, string> = {}
  for (const kv of p.getAll('attr')) {
    const i = kv.indexOf('=')
    if (i > 0) attrs[kv.slice(0, i)] = kv.slice(i + 1)
  }
  return { view: p.get('view') || 'all', project: p.get('project') ?? '', group: p.get('group') ?? '', q: p.get('q') ?? '', attrs }
}

/** What each status view asks the server for. "removed" is not a filter on the fleet and has none. */
export const VIEW_FILTERS: Record<string, Partial<AgentQuery>> = {
  all: {},
  connected: { connected: true },
  offline: { connected: false },
  healthy: { connected: true, healthy: true },
  unhealthy: { connected: true, healthy: false },
  config_failed: { configStatus: 'failed' },
  removed: {},
}

/** The server query that counts the collectors a saved view shows. */
export function countQuery(f: FleetFilters): AgentQuery {
  return { limit: 1, offset: 0, sort: 'name', order: 'asc', attrs: f.attrs, groupId: f.group || undefined, project: f.project || undefined, search: f.q.trim() || undefined, ...(VIEW_FILTERS[f.view] ?? {}) }
}

/** A short description of filters, for lists of saved views. */
export function describeFilters(f: FleetFilters, names: { project?: (id: string) => string; group?: (id: string) => string } = {}): string {
  const parts: string[] = []
  if (f.view !== 'all') parts.push(f.view.replace('_', ' '))
  if (f.project) parts.push(`project ${f.project === 'none' ? 'none' : (names.project?.(f.project) ?? f.project.slice(0, 8))}`)
  if (f.group) parts.push(`group ${names.group?.(f.group) ?? f.group.slice(0, 8)}`)
  if (f.q.trim()) parts.push(`"${f.q.trim()}"`)
  for (const k of Object.keys(f.attrs).sort()) parts.push(`${k}=${f.attrs[k]}`)
  return parts.length > 0 ? parts.join(' · ') : 'every collector'
}

/** The fleet counts an overview card can show. "offline" is worked out from the others. */
export const METRICS = {
  total: { label: 'Collectors', to: '/agents', tone: 'accent', alarming: false },
  connected: { label: 'Connected', to: '/agents?view=connected', tone: 'accent', alarming: false },
  healthy: { label: 'Healthy', to: '/agents?view=healthy', tone: 'success', alarming: false },
  unhealthy: { label: 'Unhealthy', to: '/agents?view=unhealthy', tone: 'danger', alarming: true },
  config_failed: { label: 'Config failed', to: '/agents?view=config_failed', tone: 'danger', alarming: true },
  offline: { label: 'Offline', to: '/agents?view=offline', tone: 'danger', alarming: true },
} as const
export type MetricId = keyof typeof METRICS

/** One card on the overview: a fleet count, or the number of collectors in a saved view. */
export type OverviewCard = { type: 'metric'; metric: MetricId } | { type: 'view'; id: string }

export const DEFAULT_CARDS: OverviewCard[] = (['total', 'connected', 'healthy', 'unhealthy', 'config_failed'] as const).map((metric) => ({ type: 'metric', metric }))

export const MAX_CARDS = 10

/** The cards to show: what was saved, minus anything that no longer exists; the defaults when nothing was saved. */
export function resolveCards(saved: OverviewCard[] | null | undefined, views: SavedView[]): OverviewCard[] {
  if (!saved) return DEFAULT_CARDS
  const seen = new Set<string>()
  return saved
    .filter((c) => {
      const key = c.type === 'metric' ? `m:${c.metric}` : `v:${c.id}`
      const exists = c.type === 'metric' ? c.metric in METRICS : views.some((v) => v.id === c.id)
      if (!exists || seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, MAX_CARDS)
}
