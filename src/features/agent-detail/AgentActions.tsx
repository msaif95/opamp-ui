import { useMutation } from '@tanstack/react-query'
import { RotateCw } from 'lucide-react'
import { useState } from 'react'
import { api, CAP_ACCEPTS_RESTART, type Agent } from '../../api-client/client'

/** Operator actions on one collector. */
export function AgentActions({ agent }: { agent: Agent }) {
  const [sent, setSent] = useState(false)
  const restart = useMutation({
    mutationFn: () => api.restartAgent(agent.instance_uid),
    onSuccess: () => {
      setSent(true)
      setTimeout(() => setSent(false), 5000)
    },
  })
  const supported = (agent.capabilities & CAP_ACCEPTS_RESTART) !== 0
  const reason = !supported ? 'This collector does not accept restart commands' : !agent.connected ? 'The collector is not connected' : undefined

  return (
    <div className="flex items-center gap-2">
      {restart.error && <span className="text-xs text-danger">{restart.error.message}</span>}
      {sent && <span className="text-xs text-success">Restart requested</span>}
      <button
        className="btn"
        disabled={reason !== undefined || restart.isPending}
        title={reason}
        onClick={() => {
          if (confirm('Restart this collector? It stops collecting for a few seconds while it restarts.')) restart.mutate()
        }}
      >
        <RotateCw size={13} /> Restart
      </button>
    </div>
  )
}
