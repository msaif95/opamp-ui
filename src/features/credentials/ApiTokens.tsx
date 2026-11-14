import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { api, type Role } from '../../api-client/client'
import { ProjectName, ProjectSelect, useHasProjects } from '../../components/ProjectSelect'
import { Modal } from '../../components/Dialogs'
import { Badge, ErrorNote, SecretOnce } from '../../components/ui'
import { timeAgo } from '../../lib/time'
import { TabIntro } from './Credentials'
import { confirmDialog } from '../../lib/dialog'
import { Select } from '../../components/Select'

const TOKEN_ROLES = [
  { value: 'viewer', label: 'Viewer', hint: 'Can look, not change' },
  { value: 'operator', label: 'Operator', hint: 'Can change configs and push' },
  { value: 'admin', label: 'Admin', hint: 'Everything, in every project' },
]

/** Create a console API token, in a dialog; the dialog then shows the secret once. */
function NewToken({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [role, setRole] = useState<Role>('operator')
  const [expiresDays, setExpiresDays] = useState('90')
  const [project, setProject] = useState<string | null | undefined>(undefined)
  const create = useMutation({
    mutationFn: () => api.createApiToken(name.trim(), role, Number(expiresDays), role === 'admin' ? null : (project ?? null)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-tokens'] }),
  })
  const submit = (e: FormEvent) => {
    e.preventDefault()
    create.mutate()
  }
  if (create.data?.secret) {
    return (
      <div className="space-y-4">
        <SecretOnce
          label="Copy this token now."
          secret={create.data.secret}
          extra={`export OPAMP_URL=${window.location.origin}\nexport OPAMP_TOKEN=${create.data.secret}\nopampctl agents`}
        />
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
        <span className="block text-xs text-muted">Name</span>
        <input className="input w-full" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. ci-pipeline" autoFocus />
      </label>
      <label className="block space-y-1">
        <span className="block text-xs text-muted">Role</span>
        <Select className="w-full" value={role} onChange={(v) => setRole(v as Role)} options={TOKEN_ROLES} aria-label="Role" />
      </label>
      {role !== 'admin' && <ProjectSelect value={project} onChange={setProject} role="admin" label="Acts in project" />}
      <label className="block space-y-1">
        <span className="block text-xs text-muted">Expires in (days, 0 = never)</span>
        <input className="input w-40" type="number" min={0} value={expiresDays} onChange={(e) => setExpiresDays(e.target.value)} />
      </label>
      {create.error && <p className="text-xs text-danger">{create.error.message}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        <button className="btn btn-primary" disabled={!name.trim() || (role !== 'admin' && !project) || create.isPending}>
          Create token
        </button>
      </div>
    </form>
  )
}

/** Long-lived tokens for the opampctl command-line tool and automation. */
export function ApiTokens() {
  const qc = useQueryClient()
  const [creating, setCreating] = useState(false)
  const hasProjects = useHasProjects()
  const tokens = useQuery({ queryKey: ['api-tokens'], queryFn: api.apiTokens })
  const revoke = useMutation({ mutationFn: api.revokeApiToken, onSuccess: () => qc.invalidateQueries({ queryKey: ['api-tokens'] }) })

  return (
    <section className="space-y-4">
      <TabIntro
        text={
          <>
            For the <code className="font-mono">opampctl</code> command-line tool and automation such as CI pipelines. A token acts with
            the role you give it. These are not for collectors; collectors use agent API keys.
          </>
        }
        action={
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
          <Plus size={14} /> New token
        </button>
        }
      />
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
                <th>
                  <span className="sr-only">Actions</span>
                </th>
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
      <Modal open={creating} onClose={() => setCreating(false)} title="New console API token">
        {creating && <NewToken onClose={() => setCreating(false)} />}
      </Modal>
    </section>
  )
}
