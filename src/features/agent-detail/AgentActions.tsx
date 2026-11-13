import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Pause, Play, RotateCw } from 'lucide-react'
import { useState } from 'react'
import { api, CAP_ACCEPTS_REMOTE_CONFIG, CAP_ACCEPTS_RESTART, type Agent } from '../../api-client/client'
import { confirmDialog } from '../../lib/dialog'

/** Operator actions on one collector: stop or resume collection, and restart the process. */
export function AgentActions({ agent }: { agent: Agent }) {
  const qc = useQueryClient()
  const [sent, setSent] = useState(false)
  const restart = useMutation({
    mutationFn: () => api.restartAgent(agent.instance_uid),
    onSuccess: () => {
      setSent(true)
      setTimeout(() => setSent(false), 5000)
    },
  })
  const pause = useMutation({
    mutationFn: (paused: boolean) => api.pauseAgent(agent.instance_uid, paused),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agents'] }),
  })
  const noRestart =
    (agent.capabilities & CAP_ACCEPTS_RESTART) === 0 ? 'This collector does not accept restart commands' : !agent.connected ? 'The collector is not connected' : undefined
  const noPause =
    (agent.capabilities & CAP_ACCEPTS_REMOTE_CONFIG) === 0
      ? 'This collector does not accept remote config'
      : !agent.desired_config
        ? 'Assign a config first, so there is something to resume to'
        : undefined
  const error = restart.error ?? pause.error

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-danger">{error.message}</span>}
      {sent && <span className="text-xs text-success">Restart requested</span>}
      {agent.paused ? (
        <button className="btn btn-primary" disabled={pause.isPending} onClick={() => pause.mutate(false)}>
          <Play size={13} /> Resume collection
        </button>
      ) : (
        <button
          className="btn"
          disabled={noPause !== undefined || pause.isPending}
          title={noPause}
          onClick={() => {
            void confirmDialog('Stop collection on this collector? It stays connected but collects and sends nothing until you resume it.').then((ok) => ok && pause.mutate(true))
          }}
        >
          <Pause size={13} /> Stop collection
        </button>
      )}
      <button
        className="btn"
        disabled={noRestart !== undefined || restart.isPending}
        title={noRestart}
        onClick={() => {
          void confirmDialog('Restart this collector? It stops collecting for a few seconds while it restarts.').then((ok) => ok && restart.mutate())
        }}
      >
        <RotateCw size={13} /> Restart
      </button>
    </div>
  )
}
