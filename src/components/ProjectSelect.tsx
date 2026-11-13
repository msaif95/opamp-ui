import { useEffect } from 'react'
import type { Role } from '../api-client/client'
import { useAuth } from '../auth/AuthProvider'
import { Select } from './Select'

/** Sentinel for "not chosen yet"; distinct from null, which means "no project". */
export const UNSET = undefined

/**
 * Picks the project a new resource is created in. Offers only projects where the user has the needed role.
 * With a single choice it selects it and shows nothing, so installations without projects look as before.
 */
export function ProjectSelect({
  value,
  onChange,
  role = 'operator',
  label = 'Project',
}: {
  value: string | null | undefined
  onChange: (project: string | null) => void
  role?: Role
  label?: string
}) {
  const { projectsFor } = useAuth()
  const options = projectsFor(role)
  const only = options.length === 1 ? options[0].id : undefined
  useEffect(() => {
    if (value === undefined && options.length > 0) onChange(options[0].id)
  }, [value, options, onChange])
  if (options.length <= 1 && only === null) return null
  return (
    <label className="space-y-1">
      <span className="block text-xs text-muted">{label}</span>
      <Select
        className="w-48"
        value={value ?? ''}
        onChange={(v) => onChange(v === '' ? null : v)}
        options={options.map((o) => ({ value: o.id ?? '', label: o.name }))}
      />
    </label>
  )
}

/** The name of a resource's project, for table cells. */
export function ProjectName({ id }: { id: string | null }) {
  const { user } = useAuth()
  if (id === null) return <span className="text-muted">–</span>
  return <>{user?.projects.find((p) => p.id === id)?.name ?? 'Unknown'}</>
}

/** True when the user can see at least one project, i.e. project columns and filters are worth showing. */
// oxlint-disable-next-line react/only-export-components
export function useHasProjects() {
  return (useAuth().user?.projects.length ?? 0) > 0
}
