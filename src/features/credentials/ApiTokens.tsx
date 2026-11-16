import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { api, type ApiToken, type Role, type TokenLimits } from '../../api-client/client'
import { ProjectName, ProjectSelect, useHasProjects } from '../../components/ProjectSelect'
import { Modal } from '../../components/Dialogs'
import { Badge, ErrorNote, SecretOnce } from '../../components/ui'
import { limitText, MAX_TOKEN_LIMIT, readLimit } from '../../lib/limits'
import { timeAgo } from '../../lib/time'
import { TabIntro } from './Credentials'
import { confirmDialog } from '../../lib/dialog'
import { Select } from '../../components/Select'

const TOKEN_ROLES = [
  { value: 'viewer', label: 'Viewer', hint: 'Can look, not change' },
  { value: 'operator', label: 'Operator', hint: 'Can change configs and push' },
  { value: 'admin', label: 'Admin', hint: 'Everything, in every project' },
]

/** The deployment's budgets per minute, which a token uses unless it has its own. */
interface Defaults {
  requests: number
  writes: number
}

const defaultText = (n: number) => (n === 0 ? 'no limit' : `${n.toLocaleString()} a minute`)

/** The two rate-limit fields of a token form. Blank uses the default; 0 means no limit. */
function LimitFields({ requests, writes, onChange, defaults }: { requests: string; writes: string; onChange: (field: 'requests' | 'writes', value: string) => void; defaults: Defaults }) {
  const bad = (text: string) => readLimit(text) === undefined
  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-medium">Rate limit (per minute)</legend>
      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-1">
          <span className="block text-xs text-muted">All requests</span>
          <input className={`input w-full ${bad(requests) ? 'border-danger' : ''}`} inputMode="numeric" value={requests} onChange={(e) => onChange('requests', e.target.value)} placeholder={`Default (${defaultText(defaults.requests)})`} />
        </label>
        <label className="block space-y-1">
          <span className="block text-xs text-muted">Changes (anything but reading)</span>
          <input className={`input w-full ${bad(writes) ? 'border-danger' : ''}`} inputMode="numeric" value={writes} onChange={(e) => onChange('writes', e.target.value)} placeholder={`Default (${defaultText(defaults.writes)})`} />
        </label>
      </div>
      <p className="text-xs text-muted">
        Leave blank to use the default, or enter 0 for no limit (at most {MAX_TOKEN_LIMIT.toLocaleString()}). Beyond its limit the token is answered "too many
        requests" until the minute has passed.
      </p>
    </fieldset>
  )
}

const limitsFrom = (requests: string, writes: string): TokenLimits | null => {
  const r = readLimit(requests)
  const w = readLimit(writes)
  return r === undefined || w === undefined ? null : { rate_limit_per_minute: r, write_limit_per_minute: w }
}

/** Change an existing token's rate limits; they apply from its next request. */
function EditLimits({ token, defaults, onClose }: { token: ApiToken; defaults: Defaults; onClose: () => void }) {
  const qc = useQueryClient()
  const [requests, setRequests] = useState(token.rate_limit_per_minute?.toString() ?? '')
  const [writes, setWrites] = useState(token.write_limit_per_minute?.toString() ?? '')
  const limits = limitsFrom(requests, writes)
  const save = useMutation({
    mutationFn: () => api.setApiTokenLimits(token.id, limits!),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['api-tokens'] })
      onClose()
    },
  })
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        save.mutate()
      }}
    >
      <LimitFields requests={requests} writes={writes} defaults={defaults} onChange={(f, v) => (f === 'requests' ? setRequests(v) : setWrites(v))} />
      {save.error && <p className="text-xs text-danger">{save.error.message}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        <button className="btn btn-primary" disabled={!limits || save.isPending}>
          Save limits
        </button>
      </div>
    </form>
  )
}

/** Create a console API token, in a dialog; the dialog then shows the secret once. */
function NewToken({ onClose, defaults }: { onClose: () => void; defaults: Defaults }) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [role, setRole] = useState<Role>('operator')
  const [expiresDays, setExpiresDays] = useState('90')
  const [project, setProject] = useState<string | null | undefined>(undefined)
  const [requests, setRequests] = useState('')
  const [writes, setWrites] = useState('')
  const limits = limitsFrom(requests, writes)
  const create = useMutation({
    mutationFn: () => api.createApiToken(name.trim(), role, Number(expiresDays), role === 'admin' ? null : (project ?? null), limits!),
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
      <LimitFields requests={requests} writes={writes} defaults={defaults} onChange={(f, v) => (f === 'requests' ? setRequests(v) : setWrites(v))} />
      {create.error && <p className="text-xs text-danger">{create.error.message}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        <button className="btn btn-primary" disabled={!name.trim() || (role !== 'admin' && !project) || !limits || create.isPending}>
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
  const [limiting, setLimiting] = useState<ApiToken | null>(null)
  // The deployment's budgets and whether limiting is switched on, to show what a token without its own limits gets.
  const system = useQuery({ queryKey: ['system'], queryFn: api.system })
  const defaults: Defaults = { requests: system.data?.status.api_rate_limit_per_minute ?? 0, writes: system.data?.status.api_rate_limit_writes_per_minute ?? 0 }
  const limitingOff = system.data?.protections.find((p) => p.key === 'api_rate_limit')?.enabled === false
  const hasProjects = useHasProjects()
  const tokens = useQuery({ queryKey: ['api-tokens'], queryFn: api.apiTokens })
  const revoke = useMutation({ mutationFn: api.revokeApiToken, onSuccess: () => qc.invalidateQueries({ queryKey: ['api-tokens'] }) })

  return (
    <section className="space-y-4">
      <TabIntro
        text={
          <>
            For the <code className="font-mono">opampctl</code> command-line tool and automation such as CI pipelines. A token acts with
            the role you give it, and can have its own rate limit. These are not for collectors; collectors use agent API keys, which
            are not rate limited here.
          </>
        }
        action={
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
          <Plus size={14} /> New token
        </button>
        }
      />
      {limitingOff && (
        <p className="card border-warning p-3 text-xs">API rate limiting is switched off on the System page, so the limits below are not being enforced.</p>
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
                <th>Requests / min</th>
                <th>Changes / min</th>
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
                    {[limitText(t.rate_limit_per_minute, defaults.requests), limitText(t.write_limit_per_minute, defaults.writes)].map((l, i) => (
                      <td key={i}>
                        {l.text}
                        {l.inherited && <span className="ml-1 text-xs text-muted">(default)</span>}
                      </td>
                    ))}
                    <td className="text-muted">{t.last_used_at ? timeAgo(t.last_used_at) : 'Never'}</td>
                    <td className="text-muted">{t.created_by}</td>
                    <td className="space-x-2 whitespace-nowrap text-right">
                      {!t.revoked_at && (
                        <button className="btn btn-sm" onClick={() => setLimiting(t)}>
                          Rate limit
                        </button>
                      )}
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
                  <td colSpan={9} className="py-6 text-center text-muted">
                    No API tokens.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
      <Modal open={creating} onClose={() => setCreating(false)} title="New console API token">
        {creating && <NewToken onClose={() => setCreating(false)} defaults={defaults} />}
      </Modal>
      <Modal open={limiting !== null} onClose={() => setLimiting(null)} title={limiting ? `Rate limit for "${limiting.name}"` : ''}>
        {limiting && <EditLimits token={limiting} defaults={defaults} onClose={() => setLimiting(null)} />}
      </Modal>
    </section>
  )
}
