import { useInfiniteQuery, useMutation } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { api } from '../../api-client/client'
import { ErrorNote, PageHeader } from '../../components/ui'

const PAGE = 100

export function AuditLog() {
  const verify = useMutation({ mutationFn: api.verifyAudit })
  // Downloads what the current search matches (everything when the search is empty), up to 100,000 events.
  const exporting = useMutation({ mutationFn: (format: 'csv' | 'json') => api.exportAudit(search, format) })
  const [input, setInput] = useState('')
  const [search, setSearch] = useState('')

  const log = useInfiniteQuery({
    queryKey: ['audit', search],
    queryFn: ({ pageParam }) => api.audit(search, pageParam),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (last) => (last.events.length === PAGE ? last.events[last.events.length - 1].id : undefined),
  })
  const events = log.data?.pages.flatMap((p) => p.events) ?? []
  const submit = (e: FormEvent) => {
    e.preventDefault()
    setSearch(input.trim())
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Audit log"
        description="Every sign-in and every change made through the console, the command-line tool or by the system itself. Events cannot be edited or deleted, and each is chained to the one before it so tampering is detectable."
        action={
          <form onSubmit={submit} className="flex gap-2">
            <input className="input w-72" placeholder="Search action, user or target" value={input} onChange={(e) => setInput(e.target.value)} aria-label="Search the audit log" />
            <button className="btn">Search</button>
            {(['csv', 'json'] as const).map((format) => (
              <button key={format} type="button" className="btn" disabled={exporting.isPending} onClick={() => exporting.mutate(format)}>
                <Download size={14} /> {format.toUpperCase()}
              </button>
            ))}
            <button type="button" className="btn" disabled={verify.isPending} onClick={() => verify.mutate()}>
              {verify.isPending ? 'Checking…' : 'Check integrity'}
            </button>
          </form>
        }
      />
      {verify.data &&
        (verify.data.intact ? (
          <p className="card border-success p-3 text-success">The audit log is intact: no event has been edited, inserted or removed.</p>
        ) : (
          <p className="card border-danger p-3 text-danger">
            The audit log has been tampered with: event {verify.data.first_broken_event_id} does not match the record that was written.
            Compare with the copy in your log store.
          </p>
        ))}
      {verify.error && <ErrorNote error={verify.error} />}
      {exporting.error && <ErrorNote error={exporting.error} />}
      <div className="card overflow-auto">
        {log.error ? (
          <ErrorNote error={log.error} />
        ) : (
          <table className="table dense">
            <thead>
              <tr>
                <th>When</th>
                <th>Who</th>
                <th>Signed in via</th>
                <th>Action</th>
                <th>Target</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap text-muted">{new Date(e.occurred_at).toLocaleString()}</td>
                  <td>{e.actor}</td>
                  <td>{e.actor_auth}</td>
                  <td className="font-mono text-xs">{e.action}</td>
                  <td className="font-mono text-xs">
                    {e.target_type}
                    {e.target_id && <span className="text-muted"> {e.target_id}</span>}
                  </td>
                  <td className="max-w-md truncate font-mono text-xs text-muted" title={JSON.stringify(e.details, null, 2)}>
                    {Object.keys(e.details).length > 0 ? JSON.stringify(e.details) : ''}
                  </td>
                </tr>
              ))}
              {!log.isLoading && events.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted">
                    No matching events.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
      {log.hasNextPage && (
        <button className="btn" disabled={log.isFetchingNextPage} onClick={() => log.fetchNextPage()}>
          {log.isFetchingNextPage ? 'Loading…' : 'Load older events'}
        </button>
      )}
    </div>
  )
}
