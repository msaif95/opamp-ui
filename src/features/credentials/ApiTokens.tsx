import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { api, type Role } from '../../api-client/client'
import { ProjectName, ProjectSelect, useHasProjects } from '../../components/ProjectSelect'
import { Badge, ErrorNote } from '../../components/ui'
import { timeAgo } from '../../lib/time'
import { confirmDialog } from '../../lib/dialog'
import { Select } from '../../components/Select'

/** Long-lived tokens for the opampctl command-line tool and automation. */
export function ApiTokens() {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [role, setRole] = useState<Role>('operator')
  const [expiresDays, setExpiresDays] = useState('90')
  const [project, setProject] = useState<string | null | undefined>(undefined)
  const hasProjects = useHasProjects()
  const tokens = useQuery({ queryKey: ['api-tokens'], queryFn: api.apiTokens })
  const refresh = () => qc.invalidateQueries({ queryKey: ['api-tokens'] })
  const create = useMutation({
    mutationFn: () => api.createApiToken(name.trim(), role, Number(expiresDays), role === 'admin' ? null : (project ?? null)),
    onSuccess: () => {
      setName('')
      return refresh()
    },
  })
  const revoke = useMutation({ mutationFn: api.revokeApiToken, onSuccess: refresh })
  const submit = (e: FormEvent) => {
    e.preventDefault()
    create.mutate()
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold">Console API tokens</h2>
        <p className="text-xs text-muted">
          For the <code className="font-mono">opampctl</code> command-line tool and automation such as CI pipelines. A token acts with the
          role you give it. These are not for collectors; collectors use the agent API keys above.
        </p>
      </div>

      <form onSubmit={submit} className="card flex flex-wrap items-end gap-3 p-4">
        <label className="space-y-1">
          <span className="block text-xs text-muted">Name</span>
          <input className="input w-64" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. ci-pipeline" />
        </label>
        <label className="space-y-1">
          <span className="block text-xs text-muted">Role</span>
          <Select className="w-40" value={role} onChange={(v) => setRole(v as Role)} options={[
              { value: 'viewer', label: 'Viewer', hint: 'Can look, not change' },
              { value: 'operator', label: 'Operator', hint: 'Can change configs and push' },
              { value: 'admin', label: 'Admin', hint: 'Everything, in every project' },
            ]} />
        </label>
        {role !== 'admin' && <ProjectSelect value={project} onChange={setProject} role="admin" label="Acts in project" />}
        <label className="space-y-1">
          <span className="block text-xs text-muted">Expires in (days, 0 = never)</span>
          <input className="input w-40" type="number" min={0} value={expiresDays} onChange={(e) => setExpiresDays(e.target.value)} />
        </label>
        <button className="btn btn-primary" disabled={!name.trim() || create.isPending}>
          Create token
        </button>
        {create.error && <p className="w-full text-xs text-danger">{create.error.message}</p>}
      </form>

      {create.data?.secret && (
        <div className="card space-y-2 border-warning p-4">
          <p className="font-medium">Copy this token now. It will not be shown again.</p>
          <pre className="overflow-auto rounded bg-panel-2 p-2 font-mono text-xs">{create.data.secret}</pre>
          <pre className="overflow-auto rounded bg-panel-2 p-2 font-mono text-xs text-muted">
            {`export OPAMP_URL=${window.location.origin}\nexport OPAMP_TOKEN=${create.data.secret}\nopampctl agents`}
          </pre>
        </div>
      )}

      <div className="card overflow-auto">
        {tokens.error ? (
          <ErrorNote error={tokens.error} />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                {hasProjects && <th>Project</th>}
                <th>Status</th>
                <th>Last used</th>
                <th>Created by</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {tokens.data?.tokens.map((t) => {
                // Compared with when the list was fetched, not the render time, to keep rendering pure.
                const expired = t.expires_at !== null && Date.parse(t.expires_at) < tokens.dataUpdatedAt
                return (
                  <tr key={t.id}>
                    <td className="font-medium">{t.name}</td>
                    <td className="capitalize">{t.role}</td>
                    {hasProjects && <td>{t.role === 'admin' ? 'All' : <ProjectName id={t.project_id} />}</td>}
                    <td>
                      {t.revoked_at ? (
                        <Badge tone="neutral">Revoked</Badge>
                      ) : expired ? (
                        <Badge tone="neutral">Expired</Badge>
                      ) : (
                        <Badge tone="success">Active</Badge>
                      )}
                      {!t.revoked_at && !expired && t.expires_at && (
                        <span className="ml-2 text-xs text-muted">until {new Date(t.expires_at).toLocaleDateString()}</span>
                      )}
                    </td>
                    <td className="text-muted">{t.last_used_at ? timeAgo(t.last_used_at) : 'Never'}</td>
                    <td className="text-muted">{t.created_by}</td>
                    <td className="text-right">
                      {!t.revoked_at && (
                        <button
                          className="btn btn-sm btn-danger"
                          disabled={revoke.isPending}
                          onClick={() => {
                            void confirmDialog(`Revoke the token "${t.name}"? Anything using it stops working immediately.`).then((ok) => ok && revoke.mutate(t.id))
                          }}
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
              {tokens.data?.tokens.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-muted">
                    No API tokens.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}
