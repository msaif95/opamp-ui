import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { api, type Person, type Role } from '../../api-client/client'
import { Modal } from '../../components/Dialogs'
import { Select } from '../../components/Select'
import { Badge, ErrorNote, PageHeader } from '../../components/ui'
import { confirmDialog } from '../../lib/dialog'
import { timeAgo } from '../../lib/time'
import { PROJECT_ROLES } from '../projects/Projects'

/** Form in a dialog: add a person (existing, or by sign-in name) to a project with a role. */
function AddToProject({ person, onClose }: { person: Person | 'new'; onClose: () => void }) {
  const qc = useQueryClient()
  const projects = useQuery({ queryKey: ['projects'], queryFn: api.projects })
  const [subject, setSubject] = useState('')
  const [projectId, setProjectId] = useState('')
  const [role, setRole] = useState<Role>('viewer')
  const who = person === 'new' ? subject.trim() : person.subject
  const taken = person === 'new' ? [] : person.projects.map((p) => p.id)
  const add = useMutation({
    mutationFn: () => api.setProjectMember(projectId, who, role),
    onSuccess: async () => {
      await Promise.all([qc.invalidateQueries({ queryKey: ['users'] }), qc.invalidateQueries({ queryKey: ['projects'] })])
      onClose()
    },
  })
  const submit = (e: FormEvent) => {
    e.preventDefault()
    add.mutate()
  }
  const options = (projects.data?.projects ?? []).filter((p) => !taken.includes(p.id)).map((p) => ({ value: p.id, label: p.name, hint: p.description || undefined }))

  return (
    <form onSubmit={submit} className="space-y-4">
      {person === 'new' && (
        <label className="block space-y-1">
          <span className="block text-xs text-muted">Sign-in name (Okta email, or local username)</span>
          <input className="input w-full" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="person@example.com" autoFocus />
        </label>
      )}
      <label className="block space-y-1">
        <span className="block text-xs text-muted">Project</span>
        <Select
          className="w-full"
          value={projectId}
          onChange={setProjectId}
          options={options}
          placeholder={projects.data?.projects.length === 0 ? 'Create a project first' : 'Select a project…'}
          aria-label="Project"
        />
      </label>
      <label className="block space-y-1">
        <span className="block text-xs text-muted">Role in that project</span>
        <Select className="w-full" value={role} onChange={(v) => setRole(v as Role)} options={PROJECT_ROLES} aria-label="Role" />
      </label>
      {add.error && <p className="text-xs text-danger">{add.error.message}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        <button className="btn btn-primary" disabled={!who || !projectId || add.isPending}>
          Add to project
        </button>
      </div>
    </form>
  )
}

function globalRole(p: Person) {
  if (p.provider === '') return <span className="text-muted">Has not signed in yet</span>
  if (p.global_role === 'admin') return <Badge tone="info">Admin</Badge>
  if (p.global_role === '') return <span className="text-muted">None</span>
  return <span className="capitalize">{p.global_role}</span>
}

/** Admin page: everyone who has signed in or been given access, their roles, and the projects they belong to. */
export function Users() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState<Person | 'new' | null>(null)
  const users = useQuery({ queryKey: ['users'], queryFn: api.users })
  const remove = useMutation({
    mutationFn: (v: { project: string; subject: string }) => api.removeProjectMember(v.project, v.subject),
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: ['users'] }), qc.invalidateQueries({ queryKey: ['projects'] })]),
  })
  const q = search.trim().toLowerCase()
  const shown = (users.data?.users ?? []).filter((u) => !q || u.subject.includes(q) || u.name.toLowerCase().includes(q) || u.projects.some((p) => p.name.toLowerCase().includes(q)))

  return (
    <div className="space-y-4">
      <PageHeader
        title="Users"
        description="Everyone who has signed in, plus people added to a project ahead of their first sign-in. A global role comes from Okta groups (or the local administrator) and covers everything outside projects; admins see all projects."
        action={
          <button className="btn btn-primary" onClick={() => setAdding('new')}>
            <Plus size={14} /> Add a person
          </button>
        }
      />

      <input className="input w-72" placeholder="Search by name, sign-in or project" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search users" />

      <div className="card overflow-auto">
        {users.error ? (
          <ErrorNote error={users.error} />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Person</th>
                <th>Signs in with</th>
                <th>Global role</th>
                <th>Projects</th>
                <th>Last sign-in</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shown.map((u) => (
                <tr key={u.subject}>
                  <td>
                    <div className="font-medium">{u.name || u.subject}</div>
                    {u.name && <div className="text-xs text-muted">{u.subject}</div>}
                  </td>
                  <td>{u.provider === 'okta' ? 'Okta' : u.provider === 'local' ? 'Local login' : '–'}</td>
                  <td>{globalRole(u)}</td>
                  <td>
                    <div className="flex flex-wrap gap-1.5">
                      {u.global_role === 'admin' && <span className="text-muted">All projects</span>}
                      {u.projects.map((p) => (
                        <span key={p.id} className="chip">
                          {p.name} · {p.role}
                          <button
                            aria-label={`Remove ${u.subject} from ${p.name}`}
                            onClick={() =>
                              void confirmDialog({
                                title: `Remove ${u.subject} from "${p.name}"?`,
                                body: 'They lose access to that project immediately.',
                                action: 'Remove',
                                danger: true,
                              }).then((ok) => ok && remove.mutate({ project: p.id, subject: u.subject }))
                            }
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                      {u.global_role !== 'admin' && u.projects.length === 0 && <span className="text-muted">None</span>}
                    </div>
                  </td>
                  <td className="text-muted">{u.last_login_at ? timeAgo(u.last_login_at) : 'Never'}</td>
                  <td className="text-right">
                    <button className="btn btn-sm" onClick={() => setAdding(u)}>
                      Add to project
                    </button>
                  </td>
                </tr>
              ))}
              {users.data && shown.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted">
                    {q ? 'Nobody matches that search.' : 'Nobody has signed in yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
        {remove.error && <p className="p-3 text-xs text-danger">{remove.error.message}</p>}
      </div>

      <Modal
        open={adding !== null}
        onClose={() => setAdding(null)}
        title={adding === 'new' || adding === null ? 'Add a person to a project' : `Add ${adding.subject} to a project`}
        description={adding === 'new' ? 'They can sign in through Okta once added, even without being in a role group.' : undefined}
      >
        {adding !== null && <AddToProject key={adding === 'new' ? 'new' : adding.subject} person={adding} onClose={() => setAdding(null)} />}
      </Modal>
    </div>
  )
}
