const TOKEN_KEY = 'opamp_token'

export type Role = 'admin' | 'operator' | 'viewer'

export interface User {
  subject: string
  provider: 'okta' | 'local' | 'token'
  /** Global role: applies to resources outside any project. Empty for someone who only has project memberships. */
  role: Role | ''
  /** Global administrators can see and change everything. */
  admin: boolean
  /** Projects this user can see, with their role in each. */
  projects: { id: string; name: string; role: Role }[]
}

export interface Project {
  id: string
  name: string
  description: string
  created_by: string
  created_at: string
  members: number
  agents: number
}

/** Someone who has signed in, or was added to a project ahead of their first sign-in. */
export interface Person {
  subject: string
  name: string
  /** Empty for someone who has never signed in. */
  provider: 'okta' | 'local' | ''
  global_role: Role | ''
  last_login_at: string | null
  projects: { id: string; name: string; role: Role }[]
}

export interface ProjectMember {
  subject: string
  role: Role
  added_by: string
  added_at: string
}

/** Every owned resource carries the project it belongs to; null means it is outside any project. */
export interface Owned {
  project_id: string | null
}

export interface Agent {
  project_id: string | null
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
  /** Collection is stopped: the collector runs an empty pipeline until resumed. */
  paused: boolean
  connected: boolean
  first_seen: string
  last_seen: string
}

/** One sample of a collector's own CPU, memory and throughput, about a minute apart. */
export interface MetricPoint {
  at: string
  cpu_pct: number | null
  rss_bytes: number | null
  heap_bytes: number | null
  received: number
  sent: number
  failed: number
}

/** A long-lived token for the CLI and automation. */
export interface ApiToken {
  project_id: string | null
  id: string
  name: string
  role: Role
  created_by: string
  created_at: string
  expires_at: string | null
  revoked_at: string | null
  last_used_at: string | null
  /** Only present in the response to creating it. */
  secret?: string
}

export interface DesiredConfig {
  version_id: string
  template_id: string
  template_name: string
  version: number
  in_sync: boolean
}

export interface ConfigTemplate {
  project_id: string | null
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
  /** The pipeline as built in the config builder; absent for versions written as YAML. */
  builder_spec?: BuilderSpec
  /** Only present in the version list of a config, and only when non-zero. */
  assigned_agents?: number
  created_at: string
}

export type BuilderKind = 'source' | 'processor' | 'destination'
export type BuilderValue = string | number | boolean | string[] | Record<string, string>

export interface BuilderField {
  key: string
  label: string
  type: 'string' | 'int' | 'number' | 'bool' | 'enum' | 'multi' | 'list' | 'map'
  required: boolean
  default?: BuilderValue
  options?: string[]
  help?: string
}

export interface BuilderType {
  kind: BuilderKind
  type: string
  label: string
  description: string
  signals: string[]
  fields: BuilderField[]
}

export interface BuilderComponent {
  type: string
  params: Record<string, BuilderValue>
  /** ID of a saved library item whose type and settings are used instead of the two fields above. */
  library?: string
}

export interface LibraryItem {
  project_id: string | null
  id: string
  kind: BuilderKind
  name: string
  type: string
  params: Record<string, BuilderValue>
  created_by: string
  updated_at: string
}

export interface BuilderSpec {
  sources: BuilderComponent[]
  processors: BuilderComponent[]
  destinations: BuilderComponent[]
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
  project_id: string | null
  id: string
  name: string
  description: string
  selector: Selector
  members: number
  created_at: string
  /** The config this group owns; matching agents with no config receive it automatically. */
  config: {
    version_id: string
    template_id: string
    template_name: string
    version: number
    set_at: string
  } | null
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
  project_id: string | null
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
  /** Pauses after every batch until someone approves the next. */
  manual_approval: boolean
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
  manual_approval: boolean
  /** Project whose collectors are targeted; null for collectors outside any project. A group's project wins. */
  project_id: string | null
}

/** AgentCapabilities bit: the agent accepts remote config from the server. */
export const CAP_ACCEPTS_REMOTE_CONFIG = 0x2
/** AgentCapabilities bit: the agent accepts restart commands. */
export const CAP_ACCEPTS_RESTART = 0x400

export interface Summary {
  total: number
  connected: number
  healthy: number
  unhealthy: number
  config_failed: number
}

export interface ApiKey {
  project_id: string | null
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
  /** A project ID, or 'none' for collectors outside any project. */
  project?: string
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
    request<{ token: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  me: () => request<User>('/auth/me'),
  summary: (project?: string) => request<Summary>(`/summary${project ? `?project_id=${project}` : ''}`),
  projects: () => request<{ projects: Project[] }>('/projects'),
  users: () => request<{ users: Person[] }>('/users'),
  createProject: (name: string, description: string) =>
    request<Project>('/projects', { method: 'POST', body: JSON.stringify({ name, description }) }),
  deleteProject: (id: string) => request<void>(`/projects/${id}`, { method: 'DELETE' }),
  projectMembers: (id: string) => request<{ members: ProjectMember[] }>(`/projects/${id}/members`),
  setProjectMember: (id: string, subject: string, role: Role) =>
    request<void>(`/projects/${id}/members`, { method: 'PUT', body: JSON.stringify({ subject, role }) }),
  removeProjectMember: (id: string, subject: string) =>
    request<void>(`/projects/${id}/members/${encodeURIComponent(subject)}`, { method: 'DELETE' }),
  setApiKeyProject: (id: string, project_id: string | null) =>
    request<{ agents_moved: number }>(`/credentials/api-keys/${id}/project`, { method: 'PUT', body: JSON.stringify({ project_id }) }),
  agents: (q: AgentQuery) => {
    const p = new URLSearchParams({ limit: String(q.limit), offset: String(q.offset), sort: q.sort, order: q.order })
    if (q.connected !== undefined) p.set('connected', String(q.connected))
    if (q.healthy !== undefined) p.set('healthy', String(q.healthy))
    if (q.configStatus) p.set('config_status', q.configStatus)
    if (q.groupId) p.set('group_id', q.groupId)
    if (q.project) p.set('project_id', q.project)
    for (const [k, v] of Object.entries(q.attrs)) p.append('attr', `${k}=${v}`)
    return request<{ agents: Agent[]; total: number }>(`/agents?${p}`)
  },
  agent: (uid: string) => request<Agent>(`/agents/${uid}`),
  pauseAgent: (uid: string, paused: boolean) => request<void>(`/agents/${uid}/${paused ? 'pause' : 'resume'}`, { method: 'POST' }),
  restartAgent: (uid: string) => request<void>(`/agents/${uid}/restart`, { method: 'POST' }),
  agentMetrics: (uid: string) => request<{ points: MetricPoint[] }>(`/agents/${uid}/metrics`),
  assignConfig: (uid: string, configVersionId: string) =>
    request<void>(`/agents/${uid}/config`, { method: 'PUT', body: JSON.stringify({ config_version_id: configVersionId }) }),
  configs: () => request<{ configs: ConfigTemplate[] }>('/configs'),
  config: (id: string) => request<{ config: ConfigTemplate; versions: ConfigVersion[] }>(`/configs/${id}`),
  configVersion: (id: string, version: number) => request<ConfigVersion>(`/configs/${id}/versions/${version}`),
  createConfig: (name: string, description: string, body: string, project_id: string | null) =>
    request<{ config: ConfigTemplate; version: ConfigVersion }>('/configs', {
      method: 'POST',
      body: JSON.stringify({ name, description, body, project_id }),
    }),
  addConfigVersion: (id: string, body: string, description: string) =>
    request<ConfigVersion>(`/configs/${id}/versions`, { method: 'POST', body: JSON.stringify({ body, description }) }),
  library: () => request<{ items: LibraryItem[] }>('/configs/builder/library'),
  saveLibraryItem: (item: { id?: string; kind: BuilderKind; name: string; type: string; params: Record<string, BuilderValue>; project_id?: string | null }) =>
    request<LibraryItem>(`/configs/builder/library${item.id ? `/${item.id}` : ''}`, {
      method: item.id ? 'PUT' : 'POST',
      body: JSON.stringify(item),
    }),
  deleteLibraryItem: (id: string) => request<void>(`/configs/builder/library/${id}`, { method: 'DELETE' }),
  builderCatalog: () => request<{ types: BuilderType[] }>('/configs/builder/catalog'),
  builderRender: (spec: BuilderSpec) =>
    request<{ body: string; issues: Issue[] }>('/configs/builder/render', { method: 'POST', body: JSON.stringify(spec) }),
  createBuiltConfig: (name: string, description: string, builder: BuilderSpec, project_id: string | null) =>
    request<{ config: ConfigTemplate; version: ConfigVersion }>('/configs', {
      method: 'POST',
      body: JSON.stringify({ name, description, builder, project_id }),
    }),
  addBuiltVersion: (id: string, builder: BuilderSpec, description: string) =>
    request<ConfigVersion>(`/configs/${id}/versions`, { method: 'POST', body: JSON.stringify({ builder, description }) }),
  deleteConfig: (id: string) => request<void>(`/configs/${id}`, { method: 'DELETE' }),
  validateConfig: (body: string) =>
    request<{ issues: Issue[] }>('/configs/validate', { method: 'POST', body: JSON.stringify({ body }) }),
  system: () => request<SystemInfo>('/system'),
  setProtection: (key: ProtectionKey, enabled: boolean) =>
    request<void>(`/system/settings/${key}`, { method: 'PUT', body: JSON.stringify({ enabled }) }),
  authConfig: () => request<AuthConfig>('/auth/config'),
  groups: () => request<{ groups: Group[] }>('/groups'),
  createGroup: (name: string, description: string, selector: Selector, project_id: string | null) =>
    request<Group>('/groups', { method: 'POST', body: JSON.stringify({ name, description, selector, project_id }) }),
  updateGroup: (id: string, name: string, description: string, selector: Selector) =>
    request<Group>(`/groups/${id}`, { method: 'PUT', body: JSON.stringify({ name, description, selector }) }),
  setGroupConfig: (id: string, configVersionId: string, batchSize: number, maxFailurePct: number) =>
    request<{ rollout: Rollout | null }>(`/groups/${id}/config`, {
      method: 'PUT',
      body: JSON.stringify({ config_version_id: configVersionId, batch_size: batchSize, max_failure_pct: maxFailurePct }),
    }),
  clearGroupConfig: (id: string) => request<void>(`/groups/${id}/config`, { method: 'DELETE' }),
  deleteGroup: (id: string) => request<void>(`/groups/${id}`, { method: 'DELETE' }),
  audit: (q: string, before?: number) => {
    const p = new URLSearchParams({ limit: '100', q })
    if (before !== undefined) p.set('before', String(before))
    return request<{ events: AuditEvent[] }>(`/audit?${p}`)
  },
  facets: (project?: string) => request<{ facets: Facet[] }>(`/agents/facets${project ? `?project_id=${project}` : ''}`),
  rollouts: () => request<{ rollouts: Rollout[] }>('/rollouts'),
  rollout: (id: string) => request<{ rollout: Rollout; problems: RolloutProblem[] }>(`/rollouts/${id}`),
  previewRollout: (selector: Selector, project_id: string | null) =>
    request<RolloutPreview>('/rollouts/preview', { method: 'POST', body: JSON.stringify({ selector, project_id }) }),
  createRollout: (r: NewRollout) => request<Rollout>('/rollouts', { method: 'POST', body: JSON.stringify(r) }),
  rolloutAction: (id: string, action: 'pause' | 'resume' | 'abort' | 'rollback') => request<void>(`/rollouts/${id}/${action}`, { method: 'POST' }),
  apiKeys: () => request<{ api_keys: ApiKey[] }>('/credentials/api-keys'),
  issueApiKey: (name: string, expiresAt: string | null, project_id: string | null) =>
    request<ApiKey>('/credentials/api-keys', { method: 'POST', body: JSON.stringify({ name, expires_at: expiresAt, project_id }) }),
  apiTokens: () => request<{ tokens: ApiToken[] }>('/auth/tokens'),
  createApiToken: (name: string, role: Role, expires_days: number, project_id: string | null) =>
    request<ApiToken>('/auth/tokens', { method: 'POST', body: JSON.stringify({ name, role, expires_days, project_id }) }),
  revokeApiToken: (id: string) => request<void>(`/auth/tokens/${id}`, { method: 'DELETE' }),
  installCommand: (req: { platform: string; version: string; labels: Record<string, string>; key_name: string; expires_days: number; project_id: string | null }) =>
    request<{ script: string; api_key_id: string }>('/agents/install-command', { method: 'POST', body: JSON.stringify(req) }),
  revokedCerts: () => request<{ revoked_certs: RevokedCert[] }>('/credentials/revoked-certs'),
  revokeCert: (name: string, certificatePem: string) =>
    request<RevokedCert>('/credentials/revoked-certs', { method: 'POST', body: JSON.stringify({ name, certificate_pem: certificatePem }) }),
  revokeCredential: (id: string) => request<void>(`/credentials/${id}`, { method: 'DELETE' }),
}

/** Opens the SSE agent event stream. EventSource cannot set headers, so the token goes in the query. */
export const openEventStream = () =>
  new EventSource(`/api/v1/events?access_token=${encodeURIComponent(getToken() ?? '')}`)
