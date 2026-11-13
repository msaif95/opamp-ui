import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api, ApiError, type BuilderType, type LibraryItem } from '../../api-client/client'
import { IssueList } from '../config-editor/parts'
import { ComponentForm } from './ComponentForm'
import { confirmDialog } from '../../lib/dialog'

/** Edits a saved library item in place, from a pipeline that uses it. */
export function LibraryItemEditor({ item, type, onDetach }: { item: LibraryItem; type: BuilderType; onDetach: () => void }) {
  const qc = useQueryClient()
  const [params, setParams] = useState(item.params)
  const dirty = JSON.stringify(params) !== JSON.stringify(item.params)
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ['builder-library'] }), qc.invalidateQueries({ queryKey: ['builder-render'] })])
  const save = useMutation({
    mutationFn: () => api.saveLibraryItem({ id: item.id, kind: item.kind, name: item.name, type: item.type, params }),
    onSuccess: refresh,
  })
  const remove = useMutation({ mutationFn: () => api.deleteLibraryItem(item.id), onSuccess: refresh })
  const error = save.error ?? remove.error

  return (
    <div className="space-y-3 px-4 pb-3">
      <p className="text-xs text-muted">
        Saved in the library as "{item.name}". Changing it here changes the library item: other configs that use it pick the change up the
        next time they are saved, not before.
      </p>
      <ComponentForm type={type} params={params} onChange={setParams} />
      {error instanceof ApiError && error.issues.length > 0 ? <IssueList issues={error.issues} /> : error && <p className="text-xs text-danger">{error.message}</p>}
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-sm btn-primary" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
          Update library item
        </button>
        <button className="btn btn-sm" onClick={onDetach}>
          Use a separate copy here
        </button>
        <button
          className="btn btn-sm btn-danger"
          disabled={remove.isPending}
          onClick={() => {
            void confirmDialog(`Delete "${item.name}" from the library? Saved configs keep working; pipelines that refer to it must pick something else when next edited.`).then((ok) => ok && remove.mutate())
          }}
        >
          Delete from library
        </button>
      </div>
    </div>
  )
}
