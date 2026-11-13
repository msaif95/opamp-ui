import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { api, type Rollout, type Summary } from '../api-client/client'
import { useAuth } from '../auth/AuthProvider'
import { toast, type ToastMessage } from '../lib/toast'

const plural = (n: number, one: string) => `${n.toLocaleString()} ${one}${n === 1 ? '' : 's'}`

/** How a bulk push reaching a state is announced. States not listed are not announced. */
function rolloutNews(r: Rollout): Pick<ToastMessage, 'title' | 'tone'> | null {
  const what = `${r.config_name} v${r.config_version}`
  switch (r.status) {
    case 'paused':
      return r.error?.startsWith('waiting for approval')
        ? { title: `Bulk push of ${what} is waiting for approval`, tone: 'info' }
        : { title: `Bulk push of ${what} paused`, tone: 'warning' }
    case 'completed':
      return (r.counts.failed ?? 0) > 0
        ? { title: `Bulk push of ${what} finished with failures`, tone: 'warning' }
        : { title: `Bulk push of ${what} completed`, tone: 'success' }
    case 'rolled_back':
      return { title: `Bulk push of ${what} was rolled back`, tone: 'danger' }
    case 'failed':
      return { title: `Bulk push of ${what} failed`, tone: 'danger' }
    case 'aborted':
      return { title: `Bulk push of ${what} was aborted`, tone: 'warning' }
    default:
      return null
  }
}

/**
 * Turns changes the user would otherwise have to be watching a page to notice into notifications: bulk pushes
 * changing state, collectors going offline or unhealthy, and (for admins) alerts. It compares each refresh with
 * the one before, so nothing is announced for the state of things when the console is opened.
 */
export function Notifier() {
  const { user, can } = useAuth()
  const rollouts = useQuery({ queryKey: ['rollouts'], queryFn: api.rollouts, refetchInterval: 15_000 })
  const summary = useQuery({ queryKey: ['summary', '', ''], queryFn: () => api.summary(), refetchInterval: 30_000 })
  const system = useQuery({ queryKey: ['system'], queryFn: api.system, refetchInterval: 60_000, enabled: can('admin') })

  const seenRollouts = useRef<Map<string, string> | null>(null)
  useEffect(() => {
    if (!rollouts.data) return
    const previous = seenRollouts.current
    seenRollouts.current = new Map(rollouts.data.rollouts.map((r) => [r.id, r.status]))
    if (!previous) return
    for (const r of rollouts.data.rollouts) {
      const before = previous.get(r.id)
      if (before === r.status) continue
      const news = rolloutNews(r)
      if (before === undefined && !news) {
        // Started by someone else while this console was open. (A push that started and already reached a
        // state worth announcing between two refreshes falls through to that announcement.)
        if (r.created_by.toLowerCase() !== user?.subject.toLowerCase())
          toast({ title: `${r.created_by} started a bulk push of ${r.config_name} v${r.config_version}`, body: `${plural(r.total_agents, 'collector')}`, tone: 'info', to: `/rollouts/${r.id}` })
        continue
      }
      if (news) toast({ ...news, body: r.error ?? undefined, to: `/rollouts/${r.id}` })
    }
  }, [rollouts.data, user])

  // Collectors are announced as counts, never one by one: a network blip can drop hundreds at once.
  const seenSummary = useRef<Summary | null>(null)
  useEffect(() => {
    const now = summary.data
    if (!now) return
    const before = seenSummary.current
    seenSummary.current = now
    if (!before) return
    const wentOffline = now.total - now.connected - (before.total - before.connected)
    if (wentOffline > 0 && now.total >= before.total) toast({ title: `${plural(wentOffline, 'collector')} went offline`, tone: 'warning', to: '/agents?view=offline' })
    const turnedUnhealthy = now.unhealthy - before.unhealthy
    if (turnedUnhealthy > 0) toast({ title: `${plural(turnedUnhealthy, 'collector')} became unhealthy`, tone: 'danger', to: '/agents?view=unhealthy' })
    const configFailed = now.config_failed - before.config_failed
    if (configFailed > 0) toast({ title: `${plural(configFailed, 'collector')} failed to apply a config`, tone: 'danger', to: '/agents?view=config_failed' })
  }, [summary.data])

  const lastAlert = useRef<string | null>(null)
  useEffect(() => {
    const alerts = system.data?.alerts
    if (!alerts) return
    const newest = alerts.reduce((max, a) => (a.at > max ? a.at : max), '')
    const since = lastAlert.current
    lastAlert.current = newest
    if (since === null) return
    alerts
      .filter((a) => a.at > since)
      .slice(0, 3)
      .forEach((a) => toast({ title: 'Alert', body: a.text, tone: 'danger', to: '/system' }))
  }, [system.data])

  return null
}
