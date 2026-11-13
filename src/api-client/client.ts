const TOKEN_KEY = 'opamp_token'

export type Role = 'admin' | 'operator' | 'viewer'

export interface User {
  subject: string
  provider: 'okta' | 'local'
  role: Role
}

export interface Agent {
  instance_uid: string
  connector_type: 'supervisor' | 'extension' | 'k8s_bridge'
  auth_mode: 'mtls' | 'api_key'
  attributes: Record<string, string>
  capabilities: number
  agent_version: string | null
  healthy: boolean | null
  health_status: string | null
  health_last_error: string | null
  effective_config_hash: string | null
  effective_config?: string | null
  remote_config_hash: string | null
  remote_config_status: 'unset' | 'applied' | 'applying' | 'failed'
  remote_config_error: string | null
  desired_config_version_id: string | null
  desired_config: DesiredConfig | null
  connected: boolean
  first_seen: string
  last_seen: string
}

export interface DesiredConfig {
  version_id: string
  template_id: string
  template_name: string
  version: number
  in_sync: boolean
}

export interface ConfigTemplate {
  id: string
  name: string
  description: string
  origin: 'ui' | 'git'
  latest_version: number
  assigned_agents: number
  /** Agents assigned per version number. */
  assigned_by_version: Record<string, number>
  created_at: string
  updated_at: string
}

export interface ConfigVersion {
  id: string
  template_id: string
  version: number
  body?: string
  author: string
  description: string
  origin: 'ui' | 'git'
  git_commit_sha: string | null
  /** Only present in the version list of a config, and only when non-zero. */
  assigned_agents?: number
  created_at: string
}

export interface Issue {
  severity: 'error' | 'warning'
  path?: string
  message: string
}

export type Selector = Record<string, string[]>

export interface Facet {
  key: string
  values: { value: string; count: number }[]
}

export type RolloutStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'rolled_back' | 'aborted'
export type RolloutAgentStatus = 'pending' | 'offered' | 'applying' | 'applied' | 'failed' | 'skipped' | 'rolled_back'

export interface Group {
  id: string
  name: string
  description: string
  selector: Selector
  members: number
  created_at: string
}

export interface AuditEvent {
  id: number
  occurred_at: string
  actor: string
  actor_auth: string
  action: string
  target_type: string
  target_id: string | null
  details: Record<string, unknown>
}

export interface SystemStatus {
  version: string
  /** Production safety checks are switched off. */
  dev_mode: boolean
  sso_issuer: string
  /** Fleet-health alert limits in percent; 0 means the rule is not configured. */
  alert_offline_pct: number
  alert_unhealthy_pct: number
  agent_offline_after_seconds: number
}

export type ProtectionKey =
  | 'sso'
  | 'local_login'
  | 'agent_tls'
  | 'agent_mtls'
  | 'alert_delivery'
  | 'telemetry'
  | 'rebalancing'
  | 'fleet_health_alerts'

export interface Protection {
  key: ProtectionKey
  /** The deployment configured this feature, so it can be switched on. */
  available: boolean
  /** Shown but not changeable at runtime. */
  locked: boolean
  /** The administrator's switch; in effect only when also available. */
  enabled: boolean
  updated_by: string | null
  updated_at: string | null
}

export interface Replica {
  id: string
  connections: number
  started_at: string
  updated_at: string
}

export interface SystemAlert {
  at: string
  text: string
  delivery: 'sent' | 'failed' | 'not_configured' | 'disabled'
}

export interface SystemInfo {
  status: SystemStatus
  protections: Protection[]
  replicas: Replica[]
  alerts: SystemAlert[]
}

export interface AuthConfig {
  local: boolean
  okta: boolean
}

export interface Rollout {
  id: string
  config_version_id: string
  config_id: string
  config_name: string
  config_version: number
  selector: Selector
  group_id: string | null
  group_name: string | null
  batch_size: number
  /** Cumulative percentage steps; null means fixed batches of batch_size. */
  canary_steps_pct: number[] | null
  max_failure_pct: number
  auto_rollback: boolean
  status: RolloutStatus
  batches_released: number
  total_batches: number
  total_agents: number
  created_by: string
  created_at: string
  finished_at: string | null
  error: string | null
  counts: Partial<Record<RolloutAgentStatus, number>>
}

export interface RolloutProblem {
  instance_uid: string
  host_name: string
  batch: number
  status: RolloutAgentStatus
  error: string
}

export interface RolloutPreview {
  total: number
  connected: number
  eligible: number
}

export interface NewRollout {
  config_version_id: string
  selector: Selector
  all_agents: boolean
  group_id: string | null
  batch_size: number
  canary_steps_pct: number[] | null
  max_failure_pct: number
  auto_rollback: boolean
}

/** AgentCapabilities bit: the agent accepts remote config from the server. */
export const CAP_ACCEPTS_REMOTE_CONFIG = 0x2

export interface Summary {
  total: number
  connected: number
  healthy: number
  unhealthy: number
  config_failed: number
}

export interface ApiKey {
  id: string
  name: string
  secret?: string
  created_by: string
  created_at: string
  expires_at: string | null
  revoked_at: string | null
  last_used_at: string | null
}

export interface RevokedCert {
  id: string
  name: string
  fingerprint_sha256: string
  subject: string
  revoked_by: string
  revoked_at: string
}

export interface AgentQuery {
  limit: number
  offset: number
  connected?: boolean
  healthy?: boolean
  configStatus?: Agent['remote_config_status']
  groupId?: string
  sort: 'name' | 'last_seen'
  order: 'asc' | 'desc'
  attrs: Record<string, string>
}

export class ApiError extends Error {
  status: number
  /** Validation issues, present on 422 responses. */
  issues: Issue[]
  constructor(status: number, message: string, issues: Issue[] = []) {
    super(message)
    this.status = status
    this.issues = issues
  }
}

export const getToken = () => sessionStorage.getItem(TOKEN_KEY)
export const setToken = (t: string | null) =>
  t ? sessionStorage.setItem(TOKEN_KEY, t) : sessionStorage.removeItem(TOKEN_KEY)

let onUnauthorized = () => {}
export const setUnauthorizedHandler = (fn: () => void) => {
  onUnauthorized = fn
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken()
  const res = await fetch(`/api/v1${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  if (res.status === 401 && token) onUnauthorized()
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ApiError(res.status, body?.error ?? res.statusText, body?.issues)
  }
  return res.status === 204 ? (undefined as T) : res.json()
}

export const api = {
  login: (username: string, password: string) =>
    request<{ token: string; user: User }>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  me: () => request<User>('/auth/me'),
  summary: () => request<Summary>('/summary'),
  agents: (q: AgentQuery) => {
    const p = new URLSearchParams({ limit: String(q.limit), offset: String(q.offset), sort: q.sort, order: q.order })
    if (q.connected !== undefined) p.set('connected', String(q.connected))
    if (q.healthy !== undefined) p.set('healthy', String(q.healthy))
    if (q.configStatus) p.set('config_status', q.configStatus)
    if (q.groupId) p.set('group_id', q.groupId)
    for (const [k, v] of Object.entries(q.attrs)) p.append('attr', `${k}=${v}`)
    return request<{ agents: Agent[]; total: number }>(`/agents?${p}`)
  },
  agent: (uid: string) => request<Agent>(`/agents/${uid}`),
  assignConfig: (uid: string, configVersionId: string) =>
    request<void>(`/agents/${uid}/config`, { method: 'PUT', body: JSON.stringify({ config_version_id: configVersionId }) }),
  configs: () => request<{ configs: ConfigTemplate[] }>('/configs'),
  config: (id: string) => request<{ config: ConfigTemplate; versions: ConfigVersion[] }>(`/configs/${id}`),
  configVersion: (id: string, version: number) => request<ConfigVersion>(`/configs/${id}/versions/${version}`),
  createConfig: (name: string, description: string, body: string) =>
    request<{ config: ConfigTemplate; version: ConfigVersion }>('/configs', {
      method: 'POST',
      body: JSON.stringify({ name, description, body }),
    }),
  addConfigVersion: (id: string, body: string, description: string) =>
    request<ConfigVersion>(`/configs/${id}/versions`, { method: 'POST', body: JSON.stringify({ body, description }) }),
  deleteConfig: (id: string) => request<void>(`/configs/${id}`, { method: 'DELETE' }),
  validateConfig: (body: string) =>
    request<{ issues: Issue[] }>('/configs/validate', { method: 'POST', body: JSON.stringify({ body }) }),
  system: () => request<SystemInfo>('/system'),
  setProtection: (key: ProtectionKey, enabled: boolean) =>
    request<void>(`/system/settings/${key}`, { method: 'PUT', body: JSON.stringify({ enabled }) }),
  authConfig: () => request<AuthConfig>('/auth/config'),
  groups: () => request<{ groups: Group[] }>('/groups'),
  createGroup: (name: string, description: string, selector: Selector) =>
    request<Group>('/groups', { method: 'POST', body: JSON.stringify({ name, description, selector }) }),
  updateGroup: (id: string, name: string, description: string, selector: Selector) =>
    request<Group>(`/groups/${id}`, { method: 'PUT', body: JSON.stringify({ name, description, selector }) }),
  deleteGroup: (id: string) => request<void>(`/groups/${id}`, { method: 'DELETE' }),
  audit: (q: string, before?: number) => {
    const p = new URLSearchParams({ limit: '100', q })
    if (before !== undefined) p.set('before', String(before))
    return request<{ events: AuditEvent[] }>(`/audit?${p}`)
  },
  facets: () => request<{ facets: Facet[] }>('/agents/facets'),
  rollouts: () => request<{ rollouts: Rollout[] }>('/rollouts'),
  rollout: (id: string) => request<{ rollout: Rollout; problems: RolloutProblem[] }>(`/rollouts/${id}`),
  previewRollout: (selector: Selector) =>
    request<RolloutPreview>('/rollouts/preview', { method: 'POST', body: JSON.stringify({ selector }) }),
  createRollout: (r: NewRollout) => request<Rollout>('/rollouts', { method: 'POST', body: JSON.stringify(r) }),
  rolloutAction: (id: string, action: 'pause' | 'resume' | 'abort' | 'rollback') => request<void>(`/rollouts/${id}/${action}`, { method: 'POST' }),
  apiKeys: () => request<{ api_keys: ApiKey[] }>('/credentials/api-keys'),
  issueApiKey: (name: string, expiresAt: string | null) =>
    request<ApiKey>('/credentials/api-keys', { method: 'POST', body: JSON.stringify({ name, expires_at: expiresAt }) }),
  revokedCerts: () => request<{ revoked_certs: RevokedCert[] }>('/credentials/revoked-certs'),
  revokeCert: (name: string, certificatePem: string) =>
    request<RevokedCert>('/credentials/revoked-certs', { method: 'POST', body: JSON.stringify({ name, certificate_pem: certificatePem }) }),
  revokeCredential: (id: string) => request<void>(`/credentials/${id}`, { method: 'DELETE' }),
}

/** Opens the SSE agent event stream. EventSource cannot set headers, so the token goes in the query. */
export const openEventStream = () =>
  new EventSource(`/api/v1/events?access_token=${encodeURIComponent(getToken() ?? '')}`)
