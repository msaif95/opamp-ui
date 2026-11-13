import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { api, type Selector } from '../../api-client/client'
import { useAuth } from '../../auth/AuthProvider'
import { SelectorPicker } from '../../components/SelectorPicker'
import { ErrorNote } from '../../components/ui'
import { SelectorChips } from '../rollout-console/parts'

export function Groups() {
  const qc = useQueryClient()
  const { can } = useAuth()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selector, setSelector] = useState<Selector>({})
  const hasSelector = Object.keys(selector).length > 0

  const groups = useQuery({ queryKey: ['groups'], queryFn: api.groups })
  const preview = useQuery({
    queryKey: ['agents', 'preview', selector],
    queryFn: () => api.previewRollout(selector),
    enabled: hasSelector,
    placeholderData: keepPreviousData,
  })
  const refresh = () => qc.invalidateQueries({ queryKey: ['groups'] })
  const create = useMutation({
    mutationFn: () => api.createGroup(name.trim(), description.trim(), selector),
    onSuccess: () => {
      setName('')
      setDescription('')
      setSelector({})
      return refresh()
    },
  })
  const remove = useMutation({ mutationFn: api.deleteGroup, onSuccess: refresh })
  const submit = (e: FormEvent) => {
    e.preventDefault()
    create.mutate()
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
                <th>Matches</th>
                <th>Agents now</th>
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
                  <td>
                    <SelectorChips selector={g.selector} />
                  </td>
                  <td>{g.members.toLocaleString()}</td>
                  <td className="text-right">
                    {can('operator') && (
                      <button
                        className="btn btn-sm btn-danger"
                        disabled={remove.isPending}
                        onClick={() => {
                          if (confirm(`Delete group "${g.name}"? Past bulk pushes keep their own record of the target.`)) remove.mutate(g.id)
                        }}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {groups.data?.groups.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-muted">
                    No groups yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {can('operator') && (
        <form onSubmit={submit} className="card max-w-4xl space-y-4 p-4">
          <h2 className="font-medium">New group</h2>
          <div className="flex flex-wrap gap-3">
            <label className="space-y-1">
              <span className="block text-xs text-muted">Name</span>
              <input className="input w-64" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. prod-emea-payments" />
            </label>
            <label className="flex-1 space-y-1">
              <span className="block text-xs text-muted">Description</span>
              <input className="input w-full" value={description} onChange={(e) => setDescription(e.target.value)} />
            </label>
          </div>
          <SelectorPicker selector={selector} onChange={setSelector} />
          <p className="text-sm">
            {!hasSelector ? (
              <span className="text-muted">Pick at least one attribute value.</span>
            ) : preview.data ? (
              `Matches ${preview.data.total.toLocaleString()} agents right now.`
            ) : (
              'Counting…'
            )}
          </p>
          {create.error && <p className="text-xs text-danger">{create.error.message}</p>}
          <button className="btn btn-primary" disabled={!name.trim() || !hasSelector || create.isPending}>
            Save group
          </button>
        </form>
      )}
    </div>
  )
}
