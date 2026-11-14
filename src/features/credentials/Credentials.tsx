import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { api, type ApiKey } from '../../api-client/client'
import { useAuth } from '../../auth/AuthProvider'
import { Modal } from '../../components/Dialogs'
import { ProjectSelect, useHasProjects } from '../../components/ProjectSelect'
import { Select } from '../../components/Select'
import { Tabs } from '../../components/Tabs'
import { Badge, ErrorNote, PageHeader, SecretOnce } from '../../components/ui'
import { confirmDialog } from '../../lib/dialog'
import { timeAgo } from '../../lib/time'
import { ApiTokens } from './ApiTokens'
import { RevokedCerts } from './RevokedCerts'
import { Secrets } from './Secrets'

function keyState(k: ApiKey) {
  if (k.revoked_at) return <Badge tone="danger">Revoked</Badge>
  if (k.expires_at && new Date(k.expires_at) < new Date()) return <Badge tone="warning">Expired</Badge>
  return <Badge tone="success">Active</Badge>
}

/** ISO time that many days from now, or null for never. */
function expiryAfter(days: number): string | null {
  return days > 0 ? new Date(Date.now() + days * 86_400_000).toISOString() : null
}

/** Issue an agent API key, in a dialog; the dialog then shows the secret once. */
function IssueKey({ onClose }: { onClose: () => void }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [expiresDays, setExpiresDays] = useState('90')
  const [project, setProject] = useState<string | null | undefined>(undefined)
  const issue = useMutation({
    mutationFn: () => api.issueApiKey(name.trim(), expiryAfter(Number(expiresDays)), project ?? null),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys'] }),
  })
  const submit = (e: FormEvent) => {
    e.preventDefault()
    issue.mutate()
  }
  if (issue.data?.secret) {
    return (
      <div className="space-y-4">
        <SecretOnce label="Copy this key now." secret={issue.data.secret} />
        <div className="flex justify-end">
          <button className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    )
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block space-y-1">
        <span className="block text-xs text-muted">Key name</span>
        <input className="input w-full" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. dc1-collectors" autoFocus />
      </label>
      <ProjectSelect value={project} onChange={setProject} role="admin" label="Project its collectors join" />
      {user?.projects.length === 0 && <p className="text-xs text-warning">Create a project first (Admin → Projects): every key belongs to one.</p>}
      <label className="block space-y-1">
        <span className="block text-xs text-muted">Expires in (days, 0 = never)</span>
        <input className="input w-40" type="number" min={0} value={expiresDays} onChange={(e) => setExpiresDays(e.target.value)} />
      </label>
      {issue.error && <p className="text-xs text-danger">{issue.error.message}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        <button className="btn btn-primary" disabled={!name.trim() || !project || issue.isPending}>
          Issue API key
        </button>
      </div>
    </form>
  )
}

/** What a tab is for, with its main action on the right. */
// oxlint-disable-next-line react/only-export-components
export function TabIntro({ text, action }: { text: ReactNode; action: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <p className="max-w-4xl text-xs text-muted">{text}</p>
      <div className="shrink-0">{action}</div>
    </div>
  )
}

export function Credentials() {
  const qc = useQueryClient()
  const [issuing, setIssuing] = useState(false)
  const { user } = useAuth()
  const hasProjects = useHasProjects()

  const keys = useQuery({ queryKey: ['api-keys'], queryFn: api.apiKeys })
  // The other tabs' lists are fetched here too, so every tab can show how many active entries it holds.
  const certs = useQuery({ queryKey: ['revoked-certs'], queryFn: api.revokedCerts })
  const tokens = useQuery({ queryKey: ['api-tokens'], queryFn: api.apiTokens })
  const secretList = useQuery({ queryKey: ['secrets'], queryFn: api.secrets })
  const counts: Record<string, number | undefined> = {
    keys: keys.data?.api_keys.filter((k) => !k.revoked_at).length,
    certificates: certs.data?.revoked_certs.length,
    tokens: tokens.data?.tokens.filter((t) => !t.revoked_at).length,
    secrets: secretList.data?.secrets.length,
  }
  const refresh = () => qc.invalidateQueries({ queryKey: ['api-keys'] })
  const revoke = useMutation({ mutationFn: api.revokeCredential, onSuccess: refresh })
  const move = useMutation({
    mutationFn: (v: { id: string; project: string | null }) => api.setApiKeyProject(v.id, v.project),
    onSuccess: () => Promise.all([refresh(), qc.invalidateQueries({ queryKey: ['agents'] })]),
  })

  return (
    <div className="space-y-4">
      <PageHeader title="Agent credentials" description="How collectors and automation prove who they are, how to cut one off, and the secrets configs refer to." />

      <Tabs
        label="Kinds of credential"
        tabs={[
          {
            value: 'keys',
            label: 'Agent API keys',
            count: counts.keys,
            content: (
              <>
          <TabIntro
            text="API keys that collectors connect with. A collector joins the project of its key. To install collectors with a new key in one step, use Fleet → Add collectors."
            action={
              <button className="btn btn-primary" onClick={() => setIssuing(true)}>
                <Plus size={14} /> Issue API key
              </button>
            }
          />

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
                  <th>
                  <span className="sr-only">Actions</span>
                </th>
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
                            void confirmDialog({
                              title: `Move the key "${k.name}" to another project?`,
                              body: 'Every collector using this key moves with it. People in the old project lose sight of those collectors.',
                              action: 'Move',
                            }).then((ok) => ok && move.mutate({ id: k.id, project: v }))
                          }}
                          options={(user?.projects ?? []).map((p) => ({ value: p.id, label: p.name }))}
                          placeholder="No project"
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
                            void confirmDialog(
                              `Revoke "${k.name}"? Agents using it are disconnected within about 30 seconds and cannot reconnect.`,
                            ).then((ok) => ok && revoke.mutate(k.id))
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
          {(revoke.error ?? move.error) && <p className="p-3 text-xs text-danger">{(revoke.error ?? move.error)?.message}</p>}
          </div>
              </>
            ),
          },
          { value: 'certificates', label: 'Revoked certificates', count: counts.certificates, content: <RevokedCerts /> },
          { value: 'tokens', label: 'Console API tokens', count: counts.tokens, content: <ApiTokens /> },
          { value: 'secrets', label: 'Config secrets', count: counts.secrets, content: <Secrets /> },
        ]}
      />

      <Modal open={issuing} onClose={() => setIssuing(false)} title="Issue an agent API key">
        {issuing && <IssueKey onClose={() => setIssuing(false)} />}
      </Modal>
    </div>
  )
}
