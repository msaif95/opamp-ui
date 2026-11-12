import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../api-client/client'
import { useAuth } from '../../auth/AuthProvider'
import { ErrorNote } from '../../components/ui'
import { timeAgo } from '../../lib/time'
import { OriginBadge } from './parts'

export function ConfigList() {
  const navigate = useNavigate()
  const { can } = useAuth()
  const { data, error } = useQuery({ queryKey: ['configs'], queryFn: api.configs })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Configs</h1>
        {can('operator') && (
          <Link to="/configs/new" className="btn btn-primary">
            <Plus size={14} /> New config
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
                <th>Name</th>
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
                  <td>
                    <OriginBadge origin={c.origin} />
                  </td>
                  <td>v{c.latest_version}</td>
                  <td>{c.assigned_agents.toLocaleString()}</td>
                  <td className="text-muted">{timeAgo(c.updated_at)}</td>
                </tr>
              ))}
              {data?.configs.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted">
                    No configs yet.
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
