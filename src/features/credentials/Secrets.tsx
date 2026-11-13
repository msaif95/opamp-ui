import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { api, type ConfigSecret } from '../../api-client/client'
import { Modal } from '../../components/Dialogs'
import { ProjectName, ProjectSelect, useHasProjects } from '../../components/ProjectSelect'
import { ErrorNote } from '../../components/ui'
import { confirmDialog } from '../../lib/dialog'
import { timeAgo } from '../../lib/time'
import { TabIntro } from './Credentials'

/** Create a secret, or replace the value of an existing one, in a dialog. The value is write-only. */
function SecretForm({ existing, onClose }: { existing: ConfigSecret | null; onClose: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState(existing?.name ?? '')
  const [value, setValue] = useState('')
  const [project, setProject] = useState<string | null | undefined>(existing ? existing.project_id : undefined)
  const save = useMutation({
    mutationFn: () => api.setSecret(name.trim(), value, project ?? null),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['secrets'] })
      onClose()
    },
  })
  const submit = (e: FormEvent) => {
    e.preventDefault()
    save.mutate()
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      {!existing && (
        <>
          <label className="block space-y-1">
            <span className="block text-xs text-muted">Name</span>
            <input className="input w-full font-mono" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. vendor_api_key" autoFocus />
          </label>
          <ProjectSelect value={project} onChange={setProject} role="admin" label="Project whose configs may use it" />
        </>
      )}
      <label className="block space-y-1">
        <span className="block text-xs text-muted">{existing ? 'New value' : 'Value'}</span>
        <input
          className="input w-full font-mono"
          type="password"
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus={existing !== null}
        />
        <span className="block text-xs text-muted">
          One token of at least 8 characters, with no spaces or quotes. Put any prefix such as "Bearer " in the config itself.
        </span>
      </label>
      {existing && (
        <p className="text-xs text-muted">
          Collectors that already have a config using this secret keep the old value until a new version of that config is pushed.
        </p>
      )}
      {save.error && <p className="text-xs text-danger">{save.error.message}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        <button className="btn btn-primary" disabled={!name.trim() || !value || save.isPending}>
          {existing ? 'Replace value' : 'Save secret'}
        </button>
      </div>
    </form>
  )
}

/** Values such as destination API keys, kept out of configs and referenced from them by name. */
export function Secrets() {
  const qc = useQueryClient()
  // null: closed; 'new': creating; otherwise the secret whose value is being replaced.
  const [form, setForm] = useState<ConfigSecret | 'new' | null>(null)
  const hasProjects = useHasProjects()
  const secrets = useQuery({ queryKey: ['secrets'], queryFn: api.secrets })
  const remove = useMutation({ mutationFn: api.deleteSecret, onSuccess: () => qc.invalidateQueries({ queryKey: ['secrets'] }) })
  const enabled = secrets.data?.enabled ?? true

  return (
    <section className="space-y-4">
      <TabIntro
        text={
          <>
            Keep values such as destination API keys out of configs. Write <code className="font-mono">{'${secret:NAME}'}</code> where the value
            belongs; it is stored encrypted, filled in only when the config is sent to a collector, and never shown again, here or in a
            collector's reported config.
          </>
        }
        action={
          <button className="btn btn-primary" disabled={!enabled} onClick={() => setForm('new')}>
            <Plus size={14} /> New secret
          </button>
        }
      />
      {!enabled && (
        <p className="card border-warning p-3 text-warning">
          Secrets are not set up: the deployment has no encryption key (<code className="font-mono">SECRETS_ENCRYPTION_KEY</code>). Until it
          does, configs that refer to a secret are not sent to collectors.
        </p>
      )}
      <div className="card overflow-auto">
        {secrets.error ? (
          <ErrorNote error={secrets.error} />
        ) : (
          <table className="table dense">
            <thead>
              <tr>
                <th>Name</th>
                <th>Use in a config as</th>
                {hasProjects && <th>Project</th>}
                <th>Last changed</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {secrets.data?.secrets.map((s) => (
                <tr key={s.id}>
                  <td className="font-mono text-xs">{s.name}</td>
                  <td className="font-mono text-xs text-muted">{`\${secret:${s.name}}`}</td>
                  {hasProjects && (
                    <td>
                      <ProjectName id={s.project_id} />
                    </td>
                  )}
                  <td className="text-muted">
                    by {s.updated_by}, {timeAgo(s.updated_at)}
                  </td>
                  <td className="space-x-2 text-right whitespace-nowrap">
                    <button className="btn btn-sm" disabled={!enabled} onClick={() => setForm(s)}>
                      Replace value
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      disabled={remove.isPending}
                      onClick={() =>
                        void confirmDialog({
                          title: `Delete the secret "${s.name}"?`,
                          body: 'Configs that refer to it can no longer be sent to collectors until a secret with this name exists again. Collectors keep the config they already have.',
                          action: 'Delete',
                          danger: true,
                        }).then((ok) => ok && remove.mutate(s.id))
                      }
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {secrets.data?.secrets.length === 0 && (
                <tr>
                  <td colSpan={hasProjects ? 5 : 4} className="py-8 text-center text-muted">
                    No secrets yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
        {remove.error && <p className="p-3 text-xs text-danger">{remove.error.message}</p>}
      </div>

      <Modal open={form !== null} onClose={() => setForm(null)} title={form === 'new' || form === null ? 'New secret' : `Replace the value of "${form.name}"`}>
        {form !== null && <SecretForm key={form === 'new' ? 'new' : form.id} existing={form === 'new' ? null : form} onClose={() => setForm(null)} />}
      </Modal>
    </section>
  )
}
