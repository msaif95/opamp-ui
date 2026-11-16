import type { AgentEvent } from '../../api-client/client'

type Tone = 'success' | 'danger' | 'warning' | 'info' | 'neutral'

const cfg = (d: AgentEvent['detail']) => (d.config ? `${d.config} v${d.version}` : d.paused ? 'the empty "collection stopped" config' : 'a config this console does not know')

/** How each kind of event reads in the timeline. */
export const KINDS: Record<string, { label: string; tone: Tone; group: string; text: (d: AgentEvent['detail']) => string }> = {
  first_seen: { label: 'First seen', tone: 'info', group: 'connection', text: (d) => `Registered for the first time${d.collector_version ? `, running collector ${d.collector_version}` : ''}.` },
  connected: { label: 'Connected', tone: 'success', group: 'connection', text: () => 'Connected to the backend.' },
  offline: { label: 'Offline', tone: 'neutral', group: 'connection', text: () => 'Went offline: the connection closed or the collector stopped reporting.' },
  healthy: { label: 'Healthy', tone: 'success', group: 'health', text: (d) => `Reported healthy${d.status ? ` (${d.status})` : ''}.` },
  unhealthy: { label: 'Unhealthy', tone: 'danger', group: 'health', text: (d) => `Reported unhealthy${d.status ? ` (${d.status})` : ''}${d.error ? `: ${d.error}` : '.'}` },
  config_assigned: { label: 'Config assigned', tone: 'info', group: 'config', text: (d) => `${cfg(d)} was assigned to this collector.` },
  config_unassigned: { label: 'Config removed', tone: 'neutral', group: 'config', text: () => 'The assigned config was removed.' },
  config_applied: { label: 'Config applied', tone: 'success', group: 'config', text: (d) => `Applied ${cfg(d)}.` },
  config_failed: { label: 'Config failed', tone: 'danger', group: 'config', text: (d) => `Failed to apply ${cfg(d)}${d.error ? `: ${d.error}` : '.'}` },
  collection_stopped: { label: 'Collection stopped', tone: 'warning', group: 'config', text: () => 'Collection was stopped from the console.' },
  collection_resumed: { label: 'Collection resumed', tone: 'success', group: 'config', text: () => 'Collection was resumed from the console.' },
  collector_version_changed: { label: 'Collector upgraded', tone: 'info', group: 'connection', text: (d) => `Collector version changed from ${d.from} to ${d.to}.` },
}
