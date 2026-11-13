import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { useState } from 'react'
import { api, CAP_REPORTS_OWN_LOGS, type Agent, type LogLine } from '../../api-client/client'
import { Select } from '../../components/Select'
import { Badge, ErrorNote } from '../../components/ui'

const tone = { error: 'danger', warn: 'warning', info: 'info', debug: 'neutral' } as const
const LEVELS = [
  { value: '', label: 'All levels' },
  { value: 'warn', label: 'Warnings and errors' },
  { value: 'error', label: 'Errors only' },
]
const shows = (level: string, l: LogLine) => level === '' || l.severity === 'error' || (level === 'warn' && l.severity === 'warn')

/** The collector's own recent log lines, newest first: for working out why it is unhealthy or rejected a config. */
export function AgentLogs({ agent }: { agent: Agent }) {
  const [level, setLevel] = useState('')
  const [text, setText] = useState('')
  const { data, error } = useQuery({ queryKey: ['agents', agent.instance_uid, 'logs'], queryFn: () => api.agentLogs(agent.instance_uid), refetchInterval: 10_000 })
  const q = text.trim().toLowerCase()
  const lines = (data?.lines ?? []).filter(
    (l) => shows(level, l) && (!q || l.message.toLowerCase().includes(q) || Object.values(l.attributes ?? {}).some((v) => v.toLowerCase().includes(q))),
  )
  const reports = (agent.capabilities & CAP_REPORTS_OWN_LOGS) !== 0

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-4xl text-xs text-muted">
          What the collector process itself logged. The newest {data?.kept ?? 500} lines are kept for {data?.kept_hours ?? 24} hours after
          the last one arrives; this is for troubleshooting, not a log archive. Values of config secrets are hidden.
        </p>
        <div className="flex shrink-0 gap-2">
          <input className="input w-56" type="search" placeholder="Filter lines" value={text} onChange={(e) => setText(e.target.value)} aria-label="Filter log lines" />
          <Select className="w-48" value={level} onChange={setLevel} options={LEVELS} aria-label="Level" />
        </div>
      </div>
      {error ? (
        <ErrorNote error={error} />
      ) : data?.lines.length === 0 ? (
        <p className="card p-4 text-muted">
          {reports ? (
            'No log lines yet. They arrive within about a minute of the collector logging something.'
          ) : (
            <>
              This collector does not send its logs. Collectors installed with the console's install script do; others need{' '}
              <code className="font-mono text-xs">reports_own_logs: true</code> under <code className="font-mono text-xs">capabilities</code> in
              the Supervisor config, then a Supervisor restart.
            </>
          )}
        </p>
      ) : (
        <div className="card overflow-auto">
          <table className="table dense">
            <thead>
              <tr>
                <th className="w-44">When</th>
                <th className="w-20">Level</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i} className={clsx(l.severity === 'error' && 'bg-danger/5')}>
                  <td className="whitespace-nowrap align-top font-mono text-xs text-muted">{new Date(l.at).toLocaleString()}</td>
                  <td className="align-top">
                    <Badge tone={tone[l.severity]}>{l.severity}</Badge>
                  </td>
                  <td className="break-words font-mono text-xs">
                    {l.message}
                    {l.attributes && (
                      <div className="mt-0.5 text-muted">
                        {Object.entries(l.attributes)
                          .map(([k, v]) => `${k}=${v}`)
                          .join('  ')}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {lines.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-muted">
                    No lines match the filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
