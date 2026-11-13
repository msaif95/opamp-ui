import { useQuery } from '@tanstack/react-query'
import { FileCode, Plus } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../api-client/client'
import { useAuth } from '../../auth/AuthProvider'
import { ProjectName, useHasProjects } from '../../components/ProjectSelect'
import { ErrorNote, PageHeader } from '../../components/ui'
import { timeAgo } from '../../lib/time'
import { OriginBadge } from './parts'
import { EmptyState } from '../../components/EmptyState'

export function ConfigList() {
  const navigate = useNavigate()
  const { can } = useAuth()
  const hasProjects = useHasProjects()
  const { data, error } = useQuery({ queryKey: ['configs'], queryFn: api.configs })

  return (
    <div className="space-y-4">
      <PageHeader
        title="Configs"
        description="Collector configs, each with a version history. Build one from sources, processors and destinations, or write the YAML yourself."
        action={
          can('operator') && (
            <>
              <Link to="/configs/new" className="btn">
                Write YAML
              </Link>
              <Link to="/configs/build" className="btn btn-primary">
                <Plus size={14} /> Build a config
              </Link>
            </>
          )
        }
      />
      {data?.configs.length === 0 ? (
        <EmptyState
          icon={FileCode}
          title="No configs yet"
          action={
            can('operator') && (
              <>
                <Link to="/configs/build" className="btn btn-primary">
                  <Plus size={14} /> Build a config
                </Link>
                <Link to="/configs/new" className="btn">
                  Write YAML
                </Link>
              </>
            )
          }
        >
          <p>
            A config is the collector's pipeline: where telemetry comes from, how it is processed and where it goes. Build one from a
            catalog of sources, processors and destinations, or paste YAML you already have. Every save is kept as a version.
          </p>
        </EmptyState>
      ) : (
      <div className="card overflow-auto">
        {error ? (
          <ErrorNote error={error} />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                {hasProjects && <th>Project</th>}
                <th>Source</th>
                <th>Latest version</th>
                <th>Assigned agents</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {data?.configs.map((c) => (
                <tr key={c.id} className="cursor-pointer" onClick={() => navigate(`/configs/${c.id}`)}>
                  <td>
                    <div className="font-medium">{c.name}</div>
                    {c.description && <div className="text-xs text-muted">{c.description}</div>}
                  </td>
                  {hasProjects && (
                    <td>
                      <ProjectName id={c.project_id} />
                    </td>
                  )}
                  <td>
                    <OriginBadge origin={c.origin} />
                  </td>
                  <td>v{c.latest_version}</td>
                  <td>
                    {c.assigned_agents.toLocaleString()}
                    {c.assigned_agents > 0 && (
                      <span className="ml-2 text-xs text-muted">
                        {Object.entries(c.assigned_by_version)
                          .sort(([a], [b]) => Number(b) - Number(a))
                          .map(([v, n]) => `v${v}: ${n.toLocaleString()}`)
                          .join(', ')}
                      </span>
                    )}
                  </td>
                  <td className="text-muted">{timeAgo(c.updated_at)}</td>
                </tr>
              ))}
              {data?.configs.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted">
                    No configs yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
      )}
    </div>
  )
}
