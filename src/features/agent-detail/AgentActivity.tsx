import { useInfiniteQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../../api-client/client'
import { Select } from '../../components/Select'
import { Badge, ErrorNote } from '../../components/ui'
import { timeAgo } from '../../lib/time'
import { KINDS } from './eventKinds'

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
