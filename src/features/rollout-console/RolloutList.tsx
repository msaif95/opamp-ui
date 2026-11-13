import { useQuery } from '@tanstack/react-query'
import { Plus, Rocket } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../api-client/client'
import { useAuth } from '../../auth/AuthProvider'
import { ProjectName, useHasProjects } from '../../components/ProjectSelect'
import { ErrorNote, PageHeader } from '../../components/ui'
import { timeAgo } from '../../lib/time'
import { ProgressBar, RolloutStatusBadge, SelectorChips } from './parts'
import { EmptyState } from '../../components/EmptyState'

export function RolloutList() {
  const navigate = useNavigate()
  const { can } = useAuth()
  const hasProjects = useHasProjects()
  const { data, error } = useQuery({
    queryKey: ['rollouts'],
    queryFn: api.rollouts,
    refetchInterval: (q) => (q.state.data?.rollouts.some((r) => r.status === 'running') ? 2000 : false),
  })

  return (
    <div className="space-y-4">
      <PageHeader
        title="Bulk push"
        description="Pushes of a config version to many collectors at once, in batches that pause or roll back when too many fail."
        action={
          can('operator') && (
            <Link to="/rollouts/new" className="btn btn-primary">
              <Plus size={14} /> New bulk push
            </Link>
          )
        }
      />
      {data?.rollouts.length === 0 ? (
        <EmptyState
          icon={Rocket}
          title="No bulk pushes yet"
          action={
            can('operator') && (
              <Link to="/rollouts/new" className="btn btn-primary">
                <Plus size={14} /> New bulk push
              </Link>
            )
          }
        >
          <p>
            A bulk push sends one config version to many collectors in batches. It pauses, or rolls back, when too many collectors in a
            batch fail, and can wait for approval between batches. You need a config and some connected collectors first.
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
                <th>Status</th>
                <th>Config</th>
                {hasProjects && <th>Project</th>}
                <th>Target</th>
                <th>Agents</th>
                <th className="w-64">Progress</th>
                <th>Started by</th>
                <th>Started</th>
              </tr>
            </thead>
            <tbody>
              {data?.rollouts.map((r) => (
                <tr key={r.id} className="cursor-pointer" onClick={() => navigate(`/rollouts/${r.id}`)}>
                  <td>
                    <RolloutStatusBadge rollout={r} />
                  </td>
                  <td>
                    {r.config_name} v{r.config_version}
                  </td>
                  {hasProjects && (
                    <td>
                      <ProjectName id={r.project_id} />
                    </td>
                  )}
                  <td>
                    <SelectorChips selector={r.selector} group={r.group_name} />
                  </td>
                  <td>{r.total_agents.toLocaleString()}</td>
                  <td>
                    <ProgressBar rollout={r} />
                  </td>
                  <td>{r.created_by}</td>
                  <td className="text-muted">{timeAgo(r.created_at)}</td>
                </tr>
              ))}
              {data?.rollouts.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted">
                    No bulk pushes yet.
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
