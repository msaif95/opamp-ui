import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api, type Group, type Selector } from '../../api-client/client'
import { useAuth } from '../../auth/AuthProvider'
import { ProjectName, ProjectSelect, useHasProjects } from '../../components/ProjectSelect'
import { SelectorPicker } from '../../components/SelectorPicker'
import { ErrorNote } from '../../components/ui'
import { SelectorChips } from '../rollout-console/parts'
import { GroupConfigForm } from './GroupConfigForm'
import { confirmDialog } from '../../lib/dialog'

export function Groups() {
  const qc = useQueryClient()
  const { can, canIn } = useAuth()
  // The group being edited; null while creating a new one.
  const [editing, setEditing] = useState<Group | null>(null)
  // The group whose config is being set.
  const [assigning, setAssigning] = useState<Group | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selector, setSelector] = useState<Selector>({})
  // Project for a new group; an existing group stays in its project.
  const [chosenProject, setChosenProject] = useState<string | null | undefined>(undefined)
  const hasProjects = useHasProjects()
  const hasSelector = Object.keys(selector).length > 0
  const project = editing ? editing.project_id : (chosenProject ?? null)

  const groups = useQuery({ queryKey: ['groups'], queryFn: api.groups })
  const preview = useQuery({
    queryKey: ['agents', 'preview', selector, project],
    queryFn: () => api.previewRollout(selector, project),
    enabled: hasSelector,
    placeholderData: keepPreviousData,
  })
  const refresh = () => qc.invalidateQueries({ queryKey: ['groups'] })

  const load = (g: Group | null) => {
    setEditing(g)
    setName(g?.name ?? '')
    setDescription(g?.description ?? '')
    setSelector(g?.selector ?? {})
  }
  const save = useMutation({
    mutationFn: () =>
      editing
        ? api.updateGroup(editing.id, name.trim(), description.trim(), selector)
        : api.createGroup(name.trim(), description.trim(), selector, project),
    onSuccess: () => {
      load(null)
      return refresh()
    },
  })
  const remove = useMutation({
    mutationFn: api.deleteGroup,
    onSuccess: (_, id) => {
      if (editing?.id === id) load(null)
      return refresh()
    },
  })
  const submit = (e: FormEvent) => {
    e.preventDefault()
    save.mutate()
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Groups</h1>
        <p className="text-xs text-muted">
          A group is a saved target. Membership is live: any agent whose attributes match belongs to it, including agents that connect later.
        </p>
      </div>

      <div className="card overflow-auto">
        {groups.error ? (
          <ErrorNote error={groups.error} />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                {hasProjects && <th>Project</th>}
                <th>Matches</th>
                <th>Agents now</th>
                <th>Config</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {groups.data?.groups.map((g) => (
                <tr key={g.id} className={editing?.id === g.id ? 'bg-selected' : undefined}>
                  <td>
                    <div className="font-medium">{g.name}</div>
                    {g.description && <div className="text-xs text-muted">{g.description}</div>}
                  </td>
                  {hasProjects && (
                    <td>
                      <ProjectName id={g.project_id} />
                    </td>
                  )}
                  <td>
                    <SelectorChips selector={g.selector} />
                  </td>
                  <td>{g.members.toLocaleString()}</td>
                  <td>
                    {g.config ? (
                      <Link to={`/configs/${g.config.template_id}`} className="text-accent hover:underline">
                        {g.config.template_name} v{g.config.version}
                      </Link>
                    ) : (
                      <span className="text-muted">None</span>
                    )}
                  </td>
                  <td className="space-x-2 text-right whitespace-nowrap">
                    {canIn(g.project_id, 'operator') && (
                      <>
                        <button className="btn btn-sm" onClick={() => setAssigning(assigning?.id === g.id ? null : g)}>
                          {g.config ? 'Change config' : 'Set config'}
                        </button>
                        <button className="btn btn-sm" onClick={() => load(g)}>
                          Edit
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          disabled={remove.isPending}
                          onClick={() => {
                            void confirmDialog(`Delete group "${g.name}"? Past bulk pushes keep their own record of the target.`).then((ok) => ok && remove.mutate(g.id))
                          }}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {groups.data?.groups.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted">
                    No groups yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {can('operator') && assigning && <GroupConfigForm key={assigning.id} group={assigning} onDone={() => setAssigning(null)} />}

      {can('operator') && (
        <form onSubmit={submit} className="card max-w-4xl space-y-4 p-4">
          <h2 className="font-medium">{editing ? `Edit group "${editing.name}"` : 'New group'}</h2>
          {editing && (
            <p className="text-xs text-muted">
              Changing what a group matches affects future bulk pushes only. Pushes already started keep the target they began with.
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            {!editing && <ProjectSelect value={chosenProject} onChange={setChosenProject} />}
            <label className="space-y-1">
              <span className="block text-xs text-muted">Name</span>
              <input className="input w-64" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. prod-emea-payments" />
            </label>
            <label className="flex-1 space-y-1">
              <span className="block text-xs text-muted">Description</span>
              <input className="input w-full" value={description} onChange={(e) => setDescription(e.target.value)} />
            </label>
          </div>
          <SelectorPicker selector={selector} onChange={setSelector} project={project} />
          <p className="text-sm">
            {!hasSelector ? (
              <span className="text-muted">Pick at least one attribute value.</span>
            ) : preview.data ? (
              `Matches ${preview.data.total.toLocaleString()} agents right now.`
            ) : (
              'Counting…'
            )}
          </p>
          {save.error && <p className="text-xs text-danger">{save.error.message}</p>}
          <div className="flex gap-2">
            <button className="btn btn-primary" disabled={!name.trim() || !hasSelector || save.isPending}>
              {editing ? 'Save changes' : 'Save group'}
            </button>
            {editing && (
              <button type="button" className="btn btn-ghost" onClick={() => load(null)}>
                Cancel
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  )
}
