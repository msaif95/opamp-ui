import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../api-client/client'
import { useAuth } from '../../auth/AuthProvider'
import { ErrorNote } from '../../components/ui'
import { timeAgo } from '../../lib/time'
import { ProgressBar, RolloutStatusBadge, SelectorChips } from './parts'

export function RolloutList() {
  const navigate = useNavigate()
  const { can } = useAuth()
  const { data, error } = useQuery({
    queryKey: ['rollouts'],
    queryFn: api.rollouts,
    refetchInterval: (q) => (q.state.data?.rollouts.some((r) => r.status === 'running') ? 2000 : false),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Bulk push</h1>
        {can('operator') && (
          <Link to="/rollouts/new" className="btn btn-primary">
            <Plus size={14} /> New bulk push
          </Link>
        )}
      </div>
      <div className="card overflow-auto">
        {error ? (
          <ErrorNote error={error} />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Config</th>
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
                  <td>
                    <SelectorChips selector={r.selector} />
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
                  <td colSpan={7} className="py-8 text-center text-muted">
                    No bulk pushes yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
