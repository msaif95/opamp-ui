import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { api, type Project, type Role } from '../../api-client/client'
import { useAuth } from '../../auth/AuthProvider'
import { ErrorNote } from '../../components/ui'
import { timeAgo } from '../../lib/time'

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
    <section className="card max-w-4xl">
      <div className="border-b border-border px-4 py-2">
        <h2 className="font-medium">People in "{project.name}"</h2>
        <p className="text-xs text-muted">
          Viewers can see the project's collectors, configs, groups and pushes. Operators can also change and push configs and restart or
          stop collectors. Global administrators can always do everything and need not be added.
        </p>
      </div>
      {members.error ? (
        <ErrorNote error={members.error} />
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Sign-in name</th>
              <th>Role in this project</th>
              <th>Added</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {members.data?.members.map((m) => (
              <tr key={m.subject}>
                <td>{m.subject}</td>
                <td>
                  <select
                    className="input w-36"
                    value={m.role}
                    aria-label={`Role of ${m.subject}`}
                    onChange={(e) => set.mutate({ subject: m.subject, role: e.target.value as Role })}
                  >
                    <option value="viewer">Viewer</option>
                    <option value="operator">Operator</option>
                  </select>
                </td>
                <td className="text-muted">
                  by {m.added_by}, {timeAgo(m.added_at)}
                </td>
                <td className="text-right">
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => {
                      if (confirm(`Remove ${m.subject} from "${project.name}"? They lose access to it immediately.`)) remove.mutate(m.subject)
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
      )}
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3 border-t border-border p-4">
        <label className="space-y-1">
          <span className="block text-xs text-muted">Sign-in name (Okta email, or local username)</span>
          <input className="input w-72" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="person@example.com" />
        </label>
        <label className="space-y-1">
          <span className="block text-xs text-muted">Role</span>
          <select className="input w-36" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="viewer">Viewer</option>
            <option value="operator">Operator</option>
          </select>
        </label>
        <button className="btn btn-primary" disabled={!subject.trim() || set.isPending}>
          Add to project
        </button>
        {error && <p className="w-full text-xs text-danger">{error.message}</p>}
      </form>
    </section>
  )
}

/** Admin page: create projects and decide who can see and operate each one. */
export function Projects() {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const projects = useQuery({ queryKey: ['projects'], queryFn: api.projects })
  const { reloadUser } = useAuth()
  // The project pickers elsewhere read the signed-in user's project list.
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ['projects'] }), reloadUser()])
  const create = useMutation({
    mutationFn: () => api.createProject(name.trim(), description.trim()),
    onSuccess: (p) => {
      setName('')
      setDescription('')
      setSelected(p.id)
      return refresh()
    },
  })
  const remove = useMutation({
    mutationFn: api.deleteProject,
    onSuccess: () => {
      setSelected(null)
      return refresh()
    },
  })
  const submit = (e: FormEvent) => {
    e.preventDefault()
    create.mutate()
  }
  const current = projects.data?.projects.find((p) => p.id === selected)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Projects</h1>
        <p className="text-xs text-muted">
          A project owns collectors, configs, groups and bulk pushes. People only see the projects they are added to. A collector joins
          the project of the API key it was installed with (Fleet → Add collectors, or Agent credentials).
        </p>
      </div>

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
                <th />
              </tr>
            </thead>
            <tbody>
              {projects.data?.projects.map((p) => (
                <tr key={p.id} className={selected === p.id ? 'bg-selected' : undefined}>
                  <td>
                    <div className="font-medium">{p.name}</div>
                    {p.description && <div className="text-xs text-muted">{p.description}</div>}
                  </td>
                  <td>{p.agents.toLocaleString()}</td>
                  <td>{p.members}</td>
                  <td className="text-muted">
                    by {p.created_by}, {timeAgo(p.created_at)}
                  </td>
                  <td className="space-x-2 text-right whitespace-nowrap">
                    <button className="btn btn-sm" onClick={() => setSelected(selected === p.id ? null : p.id)}>
                      Manage people
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      disabled={remove.isPending}
                      onClick={() => {
                        if (confirm(`Delete project "${p.name}"? This only works once it owns no collectors, keys, configs, groups or pushes.`))
                          remove.mutate(p.id)
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {projects.data?.projects.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted">
                    No projects yet. Until you create one, everything is outside any project and people see it according to their global role.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
        {remove.error && <p className="p-3 text-xs text-danger">{remove.error.message}</p>}
      </div>

      {current && <Members key={current.id} project={current} />}

      <form onSubmit={submit} className="card flex max-w-4xl flex-wrap items-end gap-3 p-4">
        <label className="space-y-1">
          <span className="block text-xs text-muted">New project name</span>
          <input className="input w-56" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. payments" />
        </label>
        <label className="flex-1 space-y-1">
          <span className="block text-xs text-muted">Description (optional)</span>
          <input className="input w-full" value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <button className="btn btn-primary" disabled={!name.trim() || create.isPending}>
          Create project
        </button>
        {create.error && <p className="w-full text-xs text-danger">{create.error.message}</p>}
      </form>
    </div>
  )
}
