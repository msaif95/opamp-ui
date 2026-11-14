import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { api, type Project, type Role } from '../../api-client/client'
import { useAuth } from '../../auth/AuthProvider'
import { Modal } from '../../components/Dialogs'
import { Badge, ErrorNote, PageHeader } from '../../components/ui'
import { timeAgo } from '../../lib/time'
import { confirmDialog } from '../../lib/dialog'
import { Select } from '../../components/Select'

// oxlint-disable-next-line react/only-export-components
export const PROJECT_ROLES = [
  { value: 'viewer', label: 'Viewer', hint: 'Can look, not change' },
  { value: 'operator', label: 'Operator', hint: 'Can change configs and push' },
]

function Members({ project }: { project: Project }) {
  const qc = useQueryClient()
  const [subject, setSubject] = useState('')
  const [role, setRole] = useState<Role>('viewer')
  const members = useQuery({ queryKey: ['projects', project.id, 'members'], queryFn: () => api.projectMembers(project.id) })
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ['projects'] })])
  const set = useMutation({
    mutationFn: (v: { subject: string; role: Role }) => api.setProjectMember(project.id, v.subject, v.role),
    onSuccess: () => {
      setSubject('')
      return refresh()
    },
  })
  const remove = useMutation({ mutationFn: (s: string) => api.removeProjectMember(project.id, s), onSuccess: refresh })
  const submit = (e: FormEvent) => {
    e.preventDefault()
    set.mutate({ subject: subject.trim(), role })
  }
  const error = set.error ?? remove.error

  return (
    <div className="space-y-4">
      {members.error ? (
        <ErrorNote error={members.error} />
      ) : (
        <div className="overflow-auto rounded-md border border-border">
        <table className="table">
          <thead>
            <tr>
              <th>Sign-in name</th>
              <th>Role in this project</th>
              <th>Added</th>
              <th>
                  <span className="sr-only">Actions</span>
                </th>
            </tr>
          </thead>
          <tbody>
            {members.data?.members.map((m) => (
              <tr key={m.subject}>
                <td>{m.subject}</td>
                <td>
                  <Select
                    className="w-36"
                    value={m.role}
                    aria-label={`Role of ${m.subject}`}
                    onChange={(v) => set.mutate({ subject: m.subject, role: v as Role })}
                    options={PROJECT_ROLES}
                  />
                </td>
                <td className="text-muted">
                  by {m.added_by}, {timeAgo(m.added_at)}
                </td>
                <td className="text-right">
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => {
                      void confirmDialog(`Remove ${m.subject} from "${project.name}"? They lose access to it immediately.`).then((ok) => ok && remove.mutate(m.subject))
                    }}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {members.data?.members.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-muted">
                  Nobody has been added yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      )}
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3 border-t border-border pt-4">
        <label className="space-y-1">
          <span className="block text-xs text-muted">Sign-in name (Okta email, or local username)</span>
          <input className="input w-72" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="person@example.com" />
        </label>
        <label className="space-y-1">
          <span className="block text-xs text-muted">Role</span>
          <Select className="w-36" value={role} onChange={(v) => setRole(v as Role)} options={PROJECT_ROLES} />
        </label>
        <button className="btn btn-primary" disabled={!subject.trim() || set.isPending}>
          Add to project
        </button>
        {error && <p className="w-full text-xs text-danger">{error.message}</p>}
      </form>
    </div>
  )
}

/** Create a project, in a dialog. */
function NewProject({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const { reloadUser } = useAuth()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const create = useMutation({
    mutationFn: () => api.createProject(name.trim(), description.trim()),
    onSuccess: async () => {
      // The project pickers elsewhere read the signed-in user's project list.
      await Promise.all([qc.invalidateQueries({ queryKey: ['projects'] }), reloadUser()])
      onClose()
    },
  })
  const submit = (e: FormEvent) => {
    e.preventDefault()
    create.mutate()
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block space-y-1">
        <span className="block text-xs text-muted">Name</span>
        <input className="input w-full" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. payments" autoFocus />
      </label>
      <label className="block space-y-1">
        <span className="block text-xs text-muted">Description (optional)</span>
        <input className="input w-full" value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      {create.error && <p className="text-xs text-danger">{create.error.message}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        <button className="btn btn-primary" disabled={!name.trim() || create.isPending}>
          Create project
        </button>
      </div>
    </form>
  )
}

/** Admin page: create projects and decide who can see and operate each one. */
export function Projects() {
  const qc = useQueryClient()
  const { reloadUser } = useAuth()
  const [creating, setCreating] = useState(false)
  const [managing, setManaging] = useState<string | null>(null)
  const [showDeleted, setShowDeleted] = useState(false)
  const projects = useQuery({ queryKey: ['projects', showDeleted], queryFn: () => api.projects(showDeleted) })
  const remove = useMutation({
    mutationFn: api.deleteProject,
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: ['projects'] }), reloadUser()]),
  })
  const current = projects.data?.projects.find((p) => p.id === managing)

  return (
    <div className="space-y-4">
      <PageHeader
        title="Projects"
        description="A project owns collectors, configs, groups and bulk pushes. People only see the projects they are added to. A collector joins the project of the API key it was installed with (Fleet → Add collectors, or Agent credentials)."
        action={
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            <Plus size={14} /> New project
          </button>
        }
      />

      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" className="accent-[var(--c-accent)]" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} />
        Show deleted projects
      </label>
      {remove.data && (
        <p className="card border-warning p-3 text-warning">
          Project deleted: {remove.data.api_keys_revoked} API keys and {remove.data.tokens_revoked} tokens revoked, {remove.data.collectors}{' '}
          collectors cut off, {remove.data.pushes_aborted} pushes aborted.
        </p>
      )}
      <div className="card overflow-auto">
        {projects.error ? (
          <ErrorNote error={projects.error} />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Collectors</th>
                <th>People</th>
                <th>Created</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {projects.data?.projects.map((p) => (
                <tr key={p.id} className={p.deleted_at ? 'text-muted' : undefined}>
                  <td>
                    <div className="font-medium">
                      {p.name} {p.deleted_at && <Badge tone="neutral">Deleted</Badge>}
                    </div>
                    {p.description && <div className="text-xs text-muted">{p.description}</div>}
                  </td>
                  <td>{p.agents.toLocaleString()}</td>
                  <td>{p.members}</td>
                  <td className="text-muted">
                    by {p.created_by}, {timeAgo(p.created_at)}
                  </td>
                  <td className="space-x-2 text-right whitespace-nowrap">
                    {p.deleted_at ? (
                      <span className="text-xs">
                        by {p.deleted_by}, {timeAgo(p.deleted_at)}
                      </span>
                    ) : (
                      <>
                        <button className="btn btn-sm" onClick={() => setManaging(p.id)}>
                          Manage people
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          disabled={remove.isPending}
                          onClick={() => {
                            void confirmDialog({
                              title: `Delete project "${p.name}"?`,
                              body: `Its API keys and tokens are revoked, so its ${p.agents.toLocaleString()} collectors are disconnected within about 30 seconds and cannot reconnect. Pushes in progress are aborted and its ${p.members} people lose access. The project and its records are kept and shown under "Show deleted"; this cannot be undone.`,
                              action: 'Delete project',
                              danger: true,
                            }).then((ok) => ok && remove.mutate(p.id))
                          }}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {projects.data?.projects.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted">
                    No projects yet. Create one to start: collectors, API keys, configs, groups and bulk pushes all belong to a project.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
        {remove.error && <p className="p-3 text-xs text-danger">{remove.error.message}</p>}
      </div>

      <Modal open={creating} onClose={() => setCreating(false)} title="New project">
        {creating && <NewProject onClose={() => setCreating(false)} />}
      </Modal>

      <Modal
        open={current !== undefined}
        onClose={() => setManaging(null)}
        size="lg"
        title={current ? `People in "${current.name}"` : ''}
        description="Viewers can see the project's collectors, configs, groups and pushes. Operators can also change and push configs and restart or stop collectors. Global administrators can always do everything and need not be added."
      >
        {current && <Members key={current.id} project={current} />}
      </Modal>
    </div>
  )
}
