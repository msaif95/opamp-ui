import { FolderKanban, Plus } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Role } from '../api-client/client'
import { useAuth } from '../auth/AuthProvider'
import { EmptyState } from './EmptyState'
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
  useEffect(() => {
    if (value === undefined && options.length > 0) onChange(options[0].id)
  }, [value, options, onChange])
  return (
    <label className="space-y-1">
      <span className="block text-xs text-muted">{label}</span>
      <Select
        className="w-48"
        value={value ?? ''}
        placeholder={options.length === 0 ? 'No project available' : 'Select a project…'}
        disabled={options.length === 0}
        onChange={onChange}
        options={options.map((o) => ({ value: o.id, label: o.name }))}
        aria-label={label}
      />
    </label>
  )
}

/**
 * Wraps pages that only make sense inside a project. Until the user can see a project it shows what to do first:
 * administrators are sent to create one, everyone else is told to ask to be added to one.
 */
export function NeedsProject({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  if ((user?.projects.length ?? 0) > 0) return children
  return (
    <EmptyState
      icon={FolderKanban}
      title="Create a project first"
      action={
        user?.admin ? (
          <Link to="/projects" className="btn btn-primary">
            <Plus size={14} /> Create a project
          </Link>
        ) : undefined
      }
    >
      <p>
        Collectors, API keys, configs, groups and bulk pushes all belong to a project, and people are given access project by project.
        Nothing can be added until one exists.
      </p>
      {!user?.admin && <p>You have not been added to a project yet. Ask an administrator to add you.</p>}
    </EmptyState>
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
