import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { api, type ApiKey } from '../../api-client/client'
import { Badge, ErrorNote } from '../../components/ui'
import { timeAgo } from '../../lib/time'
import { ApiTokens } from './ApiTokens'
import { RevokedCerts } from './RevokedCerts'
import { useAuth } from '../../auth/AuthProvider'
import { ProjectSelect, useHasProjects } from '../../components/ProjectSelect'
import { confirmDialog } from '../../lib/dialog'
import { Select } from '../../components/Select'

function keyState(k: ApiKey) {
  if (k.revoked_at) return <Badge tone="danger">Revoked</Badge>
  if (k.expires_at && new Date(k.expires_at) < new Date()) return <Badge tone="warning">Expired</Badge>
  return <Badge tone="success">Active</Badge>
}

/** ISO time that many days from now, or null for never. */
function expiryAfter(days: number): string | null {
  return days > 0 ? new Date(Date.now() + days * 86_400_000).toISOString() : null
}

export function Credentials() {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [expiresDays, setExpiresDays] = useState('90')
  const [issued, setIssued] = useState<ApiKey | null>(null)

  const keys = useQuery({ queryKey: ['api-keys'], queryFn: api.apiKeys })
  const refresh = () => qc.invalidateQueries({ queryKey: ['api-keys'] })

  const issue = useMutation({
    mutationFn: () => {
      const days = Number(expiresDays)
      return api.issueApiKey(name.trim(), expiryAfter(days), project ?? null)
    },
    onSuccess: (key) => {
      setIssued(key)
      setName('')
      return refresh()
    },
  })
  const revoke = useMutation({ mutationFn: api.revokeCredential, onSuccess: refresh })
  const move = useMutation({
    mutationFn: (v: { id: string; project: string | null }) => api.setApiKeyProject(v.id, v.project),
    onSuccess: () => Promise.all([refresh(), qc.invalidateQueries({ queryKey: ['agents'] })]),
  })
  const [project, setProject] = useState<string | null | undefined>(undefined)
  const { user } = useAuth()
  const hasProjects = useHasProjects()

  const submit = (e: FormEvent) => {
    e.preventDefault()
    issue.mutate()
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Agent credentials</h1>

      <form onSubmit={submit} className="card flex flex-wrap items-end gap-3 p-4">
        <label className="space-y-1">
          <span className="block text-xs text-muted">Key name</span>
          <input className="input w-64" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. dc1-collectors" />
        </label>
        <ProjectSelect value={project} onChange={setProject} role="admin" label="Project its collectors join" />
        <label className="space-y-1">
          <span className="block text-xs text-muted">Expires in (days, 0 = never)</span>
          <input className="input w-40" type="number" min={0} value={expiresDays} onChange={(e) => setExpiresDays(e.target.value)} />
        </label>
        <button className="btn btn-primary" disabled={!name.trim() || issue.isPending}>
          Issue API key
        </button>
        {issue.error && <span className="text-xs text-danger">{issue.error.message}</span>}
      </form>

      {issued?.secret && (
        <div className="card space-y-2 border-warning p-4">
          <p className="font-medium">Copy this key now. It will not be shown again.</p>
          <code className="block break-all rounded bg-panel-2 p-2 font-mono text-xs">{issued.secret}</code>
          <button className="btn btn-sm" onClick={() => setIssued(null)}>
            Dismiss
          </button>
        </div>
      )}

      <div className="card overflow-auto">
        {keys.error ? (
          <ErrorNote error={keys.error} />
        ) : (
          <table className="table dense">
            <thead>
              <tr>
                <th>Name</th>
                {hasProjects && <th>Project</th>}
                <th>State</th>
                <th>Created by</th>
                <th>Created</th>
                <th>Expires</th>
                <th>Last used</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {keys.data?.api_keys.map((k) => (
                <tr key={k.id}>
                  <td>{k.name}</td>
                  {hasProjects && (
                    <td>
                      <Select
                        className="w-40"
                        value={k.project_id ?? ''}
                        disabled={k.revoked_at !== null || move.isPending}
                        aria-label={`Project of ${k.name}`}
                        onChange={(v) => {
                          const target = v || null
                          void confirmDialog({
                            title: `Move the key "${k.name}" to ${target ? 'that project' : 'no project'}?`,
                            body: 'Every collector using this key moves with it. People in the old project lose sight of those collectors.',
                            action: 'Move',
                          }).then((ok) => ok && move.mutate({ id: k.id, project: target }))
                        }}
                        options={[{ value: '', label: 'No project' }, ...(user?.projects ?? []).map((p) => ({ value: p.id, label: p.name }))]}
                      />
                    </td>
                  )}
                  <td>{keyState(k)}</td>
                  <td>{k.created_by}</td>
                  <td className="text-muted">{timeAgo(k.created_at)}</td>
                  <td className="text-muted">{k.expires_at ? new Date(k.expires_at).toLocaleDateString() : 'Never'}</td>
                  <td className="text-muted">{k.last_used_at ? timeAgo(k.last_used_at) : 'Never'}</td>
                  <td className="text-right">
                    {!k.revoked_at && (
                      <button
                        className="btn btn-sm btn-danger"
                        disabled={revoke.isPending}
                        onClick={() => {
                          void confirmDialog(`Revoke "${k.name}"? Agents using it are disconnected within about 30 seconds and cannot reconnect.`).then((ok) => ok && revoke.mutate(k.id))
                        }}
                      >
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {keys.data?.api_keys.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted">
                    No API keys issued yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <RevokedCerts />
      <ApiTokens />
    </div>
  )
}
