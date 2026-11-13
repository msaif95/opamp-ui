import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthProvider'
import { LoginPage } from './auth/LoginPage'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Layout } from './components/Layout'
import { AgentDetail } from './features/agent-detail/AgentDetail'
import { ConfigDetail } from './features/config-editor/ConfigDetail'
import { ConfigList } from './features/config-editor/ConfigList'
import { NewConfig } from './features/config-editor/NewConfig'
import { PipelineBuilder } from './features/config-builder/PipelineBuilder'
import { Credentials } from './features/credentials/Credentials'
import { AuditLog } from './features/audit-log/AuditLog'
import { InstallCollector } from './features/install/InstallCollector'
import { System } from './features/system/System'
import { Groups } from './features/targeting/Groups'
import { Projects } from './features/projects/Projects'
import { NewRollout } from './features/rollout-console/NewRollout'
import { RolloutDetail } from './features/rollout-console/RolloutDetail'
import { RolloutList } from './features/rollout-console/RolloutList'
import { ThemeProvider } from './state/ThemeContext'
import { FleetDashboard } from './features/fleet-dashboard/FleetDashboard'

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } })

function Shell() {
  const { user, loading, can } = useAuth()
  if (loading) return null
  if (!user) return <LoginPage />
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/agents" element={<FleetDashboard />} />
        {can('admin') && <Route path="/agents/install" element={<InstallCollector />} />}
        <Route path="/agents/:uid" element={<AgentDetail />} />
        <Route path="/configs" element={<ConfigList />} />
        {can('operator') && <Route path="/configs/new" element={<NewConfig />} />}
        {can('operator') && <Route path="/configs/build" element={<PipelineBuilder />} />}
        {can('operator') && <Route path="/configs/:id/build" element={<PipelineBuilder />} />}
        <Route path="/configs/:id" element={<ConfigDetail />} />
        <Route path="/groups" element={<Groups />} />
        {can('admin') && <Route path="/projects" element={<Projects />} />}
        {can('admin') && <Route path="/audit" element={<AuditLog />} />}
        {can('admin') && <Route path="/system" element={<System />} />}
        <Route path="/rollouts" element={<RolloutList />} />
        {can('operator') && <Route path="/rollouts/new" element={<NewRollout />} />}
        <Route path="/rollouts/:id" element={<RolloutDetail />} />
        {can('admin') && <Route path="/credentials" element={<Credentials />} />}
        <Route path="*" element={<Navigate to="/agents" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <Shell />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
      </ErrorBoundary>
    </ThemeProvider>
  )
}
