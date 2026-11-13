import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api, type Group, type Selector } from '../../api-client/client'
import { useAuth } from '../../auth/AuthProvider'
import { ProjectName, ProjectSelect, useHasProjects } from '../../components/ProjectSelect'
import { SelectorPicker } from '../../components/SelectorPicker'
import { Modal } from '../../components/Dialogs'
import { ErrorNote, PageHeader } from '../../components/ui'
import { SelectorChips } from '../rollout-console/parts'
import { GroupConfigForm } from './GroupConfigForm'
import { confirmDialog } from '../../lib/dialog'

/** Create or edit a group, in a dialog. */
function GroupForm({ group, onClose }: { group: Group | null; onClose: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState(group?.name ?? '')
  const [description, setDescription] = useState(group?.description ?? '')
  const [selector, setSelector] = useState<Selector>(group?.selector ?? {})
  // Project for a new group; an existing group stays in its project.
  const [chosenProject, setChosenProject] = useState<string | null | undefined>(undefined)
  const project = group ? group.project_id : (chosenProject ?? null)
  const hasSelector = Object.keys(selector).length > 0

  const preview = useQuery({
    queryKey: ['agents', 'preview', selector, project],
    queryFn: () => api.previewRollout(selector, project),
    enabled: hasSelector,
    placeholderData: keepPreviousData,
  })
  const save = useMutation({
    mutationFn: () =>
      group ? api.updateGroup(group.id, name.trim(), description.trim(), selector) : api.createGroup(name.trim(), description.trim(), selector, project),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['groups'] })
      onClose()
    },
  })
  const submit = (e: FormEvent) => {
    e.preventDefault()
    save.mutate()
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex flex-wrap gap-3">
        {!group && (
          <ProjectSelect
            value={chosenProject}
            onChange={(p) => {
              // Attributes differ per project, so a selector picked for another project no longer applies.
              setChosenProject(p)
              setSelector({})
            }}
          />
        )}
        <label className="space-y-1">
          <span className="block text-xs text-muted">Name</span>
          <input className="input w-64" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. prod-emea-payments" autoFocus />
        </label>
        <label className="min-w-48 flex-1 space-y-1">
          <span className="block text-xs text-muted">Description (optional)</span>
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
      <div className="flex justify-end gap-2">
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        <button className="btn btn-primary" disabled={!name.trim() || !hasSelector || save.isPending}>
          {group ? 'Save changes' : 'Create group'}
        </button>
      </div>
    </form>
  )
}

export function Groups() {
  const qc = useQueryClient()
  const { can, canIn } = useAuth()
  // The dialog that is open: the create/edit form, or a group's config form.
  const [form, setForm] = useState<Group | 'new' | null>(null)
  const [assigning, setAssigning] = useState<Group | null>(null)
  const hasProjects = useHasProjects()

  const groups = useQuery({ queryKey: ['groups'], queryFn: api.groups })
  const remove = useMutation({ mutationFn: api.deleteGroup, onSuccess: () => qc.invalidateQueries({ queryKey: ['groups'] }) })

  return (
    <div className="space-y-4">
      <PageHeader
        title="Groups"
        description="A group is a saved target. Membership is live: any agent whose attributes match belongs to it, including agents that connect later."
        action={
          can('operator') && (
            <button className="btn btn-primary" onClick={() => setForm('new')}>
              <Plus size={14} /> New group
            </button>
          )
        }
      />

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
                <tr key={g.id}>
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
                        <button className="btn btn-sm" onClick={() => setAssigning(g)}>
                          {g.config ? 'Change config' : 'Set config'}
                        </button>
                        <button className="btn btn-sm" onClick={() => setForm(g)}>
                          Edit
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          disabled={remove.isPending}
                          onClick={() => {
                            void confirmDialog(`Delete group "${g.name}"? Past bulk pushes keep their own record of the target.`).then(
                              (ok) => ok && remove.mutate(g.id),
                            )
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
        {remove.error && <p className="p-3 text-xs text-danger">{remove.error.message}</p>}
      </div>

      <Modal
        open={form !== null}
        onClose={() => setForm(null)}
        size="xl"
        title={form === 'new' || form === null ? 'New group' : `Edit group "${form.name}"`}
        description={
          form !== 'new' && form !== null
            ? 'Changing what a group matches affects future bulk pushes only. Pushes already started keep the target they began with.'
            : undefined
        }
      >
        {form !== null && <GroupForm key={form === 'new' ? 'new' : form.id} group={form === 'new' ? null : form} onClose={() => setForm(null)} />}
      </Modal>

      <Modal
        open={assigning !== null}
        onClose={() => setAssigning(null)}
        size="lg"
        title={assigning ? `Config for group "${assigning.name}"` : ''}
        description={
          assigning
            ? `The config is pushed to the group's ${assigning.members.toLocaleString()} current agents in batches. Once that push completes, agents that join the group later and have no config receive it automatically. Agents that already have a different config keep it until a push changes it.`
            : undefined
        }
      >
        {assigning && <GroupConfigForm key={assigning.id} group={assigning} onDone={() => setAssigning(null)} />}
      </Modal>
    </div>
  )
}
