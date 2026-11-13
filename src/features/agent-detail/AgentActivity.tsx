import { useInfiniteQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api, type AgentEvent } from '../../api-client/client'
import { Select } from '../../components/Select'
import { Badge, ErrorNote } from '../../components/ui'
import { timeAgo } from '../../lib/time'

type Tone = 'success' | 'danger' | 'warning' | 'info' | 'neutral'

const cfg = (d: AgentEvent['detail']) => (d.config ? `${d.config} v${d.version}` : d.paused ? 'the empty "collection stopped" config' : 'a config this console does not know')

/** How each kind of event reads in the timeline. */
const KINDS: Record<string, { label: string; tone: Tone; group: string; text: (d: AgentEvent['detail']) => string }> = {
  first_seen: { label: 'First seen', tone: 'info', group: 'connection', text: (d) => `Registered for the first time${d.collector_version ? `, running collector ${d.collector_version}` : ''}.` },
  connected: { label: 'Connected', tone: 'success', group: 'connection', text: () => 'Connected to the backend.' },
  offline: { label: 'Offline', tone: 'neutral', group: 'connection', text: () => 'Went offline: the connection closed or the collector stopped reporting.' },
  healthy: { label: 'Healthy', tone: 'success', group: 'health', text: (d) => `Reported healthy${d.status ? ` (${d.status})` : ''}.` },
  unhealthy: { label: 'Unhealthy', tone: 'danger', group: 'health', text: (d) => `Reported unhealthy${d.status ? ` (${d.status})` : ''}${d.error ? `: ${d.error}` : '.'}` },
  config_assigned: { label: 'Config assigned', tone: 'info', group: 'config', text: (d) => `${cfg(d)} was assigned to this collector.` },
  config_unassigned: { label: 'Config removed', tone: 'neutral', group: 'config', text: () => 'The assigned config was removed.' },
  config_applied: { label: 'Config applied', tone: 'success', group: 'config', text: (d) => `Applied ${cfg(d)}.` },
  config_failed: { label: 'Config failed', tone: 'danger', group: 'config', text: (d) => `Failed to apply ${cfg(d)}${d.error ? `: ${d.error}` : '.'}` },
  collection_stopped: { label: 'Collection stopped', tone: 'warning', group: 'config', text: () => 'Collection was stopped from the console.' },
  collection_resumed: { label: 'Collection resumed', tone: 'success', group: 'config', text: () => 'Collection was resumed from the console.' },
  collector_version_changed: { label: 'Collector upgraded', tone: 'info', group: 'connection', text: (d) => `Collector version changed from ${d.from} to ${d.to}.` },
}

const FILTERS = [
  { value: '', label: 'All activity' },
  { value: 'connection', label: 'Connection', hint: 'Connected, offline, upgrades' },
  { value: 'health', label: 'Health', hint: 'Healthy and unhealthy' },
  { value: 'config', label: 'Config', hint: 'Assigned, applied, failed' },
]

/** Everything that has happened to one collector, newest first. */
export function AgentActivity({ uid }: { uid: string }) {
  const [filter, setFilter] = useState('')
  const events = useInfiniteQuery({
    queryKey: ['agents', uid, 'events'],
    queryFn: ({ pageParam }) => api.agentEvents(uid, pageParam),
    initialPageParam: 0,
    // A full page means there may be older events; continue before the oldest one shown.
    getNextPageParam: (last) => (last.events.length === 100 ? last.events[last.events.length - 1].id : undefined),
    refetchInterval: 30_000,
  })
  const all = events.data?.pages.flatMap((p) => p.events) ?? []
  const shown = all.filter((e) => !filter || KINDS[e.kind]?.group === filter)

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <p className="max-w-4xl text-xs text-muted">
          Every change in this collector's connection, health and config, recorded as it happens and kept for 90 days by default. Routine
          heartbeats are not listed.
        </p>
        <Select className="w-44 shrink-0" value={filter} onChange={setFilter} options={FILTERS} aria-label="Filter activity" />
      </div>
      <div className="card overflow-auto">
        {events.error ? (
          <ErrorNote error={events.error} />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th className="w-56">When</th>
                <th className="w-44">Event</th>
                <th>What happened</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((e) => {
                const k = KINDS[e.kind]
                return (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap">
                      {new Date(e.occurred_at).toLocaleString()} <span className="text-xs text-muted">({timeAgo(e.occurred_at)})</span>
                    </td>
                    <td>
                      <Badge tone={k?.tone ?? 'neutral'}>{k?.label ?? e.kind}</Badge>
                    </td>
                    <td className="break-words">{k ? k.text(e.detail) : JSON.stringify(e.detail)}</td>
                  </tr>
                )
              })}
              {events.data && shown.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-muted">
                    {all.length === 0
                      ? 'Nothing recorded yet. History starts from when this feature was switched on; earlier events were not kept.'
                      : 'Nothing of that kind in the loaded history.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
      {events.hasNextPage && (
        <button className="btn" disabled={events.isFetchingNextPage} onClick={() => void events.fetchNextPage()}>
          {events.isFetchingNextPage ? 'Loading…' : 'Load older activity'}
        </button>
      )}
    </>
  )
}
