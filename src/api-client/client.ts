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
export type RolloutAgentStatus = 'pending' | 'offered' | 'applying' | 'applied' | 'failed' | 'skipped'

export interface Rollout {
  id: string
  config_version_id: string
  config_id: string
  config_name: string
  config_version: number
  selector: Selector
  batch_size: number
  max_failure_pct: number
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
  batch_size: number
  max_failure_pct: number
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

export interface AgentQuery {
  limit: number
  offset: number
  connected?: boolean
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
    const p = new URLSearchParams({ limit: String(q.limit), offset: String(q.offset) })
    if (q.connected !== undefined) p.set('connected', String(q.connected))
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
  facets: () => request<{ facets: Facet[] }>('/agents/facets'),
  rollouts: () => request<{ rollouts: Rollout[] }>('/rollouts'),
  rollout: (id: string) => request<{ rollout: Rollout; problems: RolloutProblem[] }>(`/rollouts/${id}`),
  previewRollout: (selector: Selector) =>
    request<RolloutPreview>('/rollouts/preview', { method: 'POST', body: JSON.stringify({ selector }) }),
  createRollout: (r: NewRollout) => request<Rollout>('/rollouts', { method: 'POST', body: JSON.stringify(r) }),
  rolloutAction: (id: string, action: 'pause' | 'resume' | 'abort') => request<void>(`/rollouts/${id}/${action}`, { method: 'POST' }),
  apiKeys: () => request<{ api_keys: ApiKey[] }>('/credentials/api-keys'),
  issueApiKey: (name: string, expiresAt: string | null) =>
    request<ApiKey>('/credentials/api-keys', { method: 'POST', body: JSON.stringify({ name, expires_at: expiresAt }) }),
  revokeCredential: (id: string) => request<void>(`/credentials/${id}`, { method: 'DELETE' }),
}

/** Opens the SSE agent event stream. EventSource cannot set headers, so the token goes in the query. */
export const openEventStream = () =>
  new EventSource(`/api/v1/events?access_token=${encodeURIComponent(getToken() ?? '')}`)
