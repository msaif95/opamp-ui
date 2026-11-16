import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthProvider'
import { LoginPage } from './auth/LoginPage'
import { DialogHost } from './components/Dialogs'
import { ErrorBoundary } from './components/ErrorBoundary'
import { NeedsProject } from './components/ProjectSelect'
import { ToastHost } from './components/Toasts'
import { Layout } from './components/Layout'
import { AgentDetail } from './features/agent-detail/AgentDetail'
import { ConfigDetail } from './features/config-editor/ConfigDetail'
import { ConfigList } from './features/config-editor/ConfigList'
import { NewConfig } from './features/config-editor/NewConfig'
import { PipelineBuilder } from './features/config-builder/PipelineBuilder'
import { Credentials } from './features/credentials/Credentials'
import { Compliance } from './features/compliance/Compliance'
import { Developer } from './features/developer/Developer'
import { InstallCollector } from './features/install/InstallCollector'
import { System } from './features/system/System'
import { Groups } from './features/targeting/Groups'
import { Projects } from './features/projects/Projects'
import { Users } from './features/users/Users'
import { NewRollout } from './features/rollout-console/NewRollout'
import { RolloutDetail } from './features/rollout-console/RolloutDetail'
import { RolloutList } from './features/rollout-console/RolloutList'
import { ThemeProvider } from './state/ThemeContext'
import { FleetDashboard } from './features/fleet-dashboard/FleetDashboard'
import { RemovedCollector } from './features/fleet-dashboard/Removed'
import { CompareAgents } from './features/compare/CompareAgents'
import { Overview } from './features/overview/Overview'
import { Topology } from './features/topology/Topology'

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } })

function Shell() {
  const { user, loading, can } = useAuth()
  if (loading) return null
  if (!user) return <LoginPage />
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/overview" element={<Overview />} />
        <Route path="/developer" element={<Developer />} />
        <Route path="/topology" element={<Topology />} />
        <Route path="/agents" element={<FleetDashboard />} />
        <Route path="/agents/compare" element={<CompareAgents />} />
        {can('admin') && <Route path="/agents/install" element={<NeedsProject><InstallCollector /></NeedsProject>} />}
        <Route path="/agents/removed/:id" element={<RemovedCollector />} />
        <Route path="/agents/:uid" element={<AgentDetail />} />
        <Route path="/configs" element={<NeedsProject><ConfigList /></NeedsProject>} />
        {can('operator') && <Route path="/configs/new" element={<NeedsProject><NewConfig /></NeedsProject>} />}
        {can('operator') && <Route path="/configs/build" element={<NeedsProject><PipelineBuilder /></NeedsProject>} />}
        {can('operator') && <Route path="/configs/:id/build" element={<NeedsProject><PipelineBuilder /></NeedsProject>} />}
        <Route path="/configs/:id" element={<NeedsProject><ConfigDetail /></NeedsProject>} />
        <Route path="/groups" element={<NeedsProject><Groups /></NeedsProject>} />
        {can('admin') && <Route path="/projects" element={<Projects />} />}
        {can('admin') && <Route path="/users" element={<Users />} />}
        {can('admin') && <Route path="/audit" element={<Compliance />} />}
        {can('admin') && <Route path="/compliance" element={<Navigate to="/audit?tab=reports" replace />} />}
        {can('admin') && <Route path="/system" element={<System />} />}
        <Route path="/rollouts" element={<NeedsProject><RolloutList /></NeedsProject>} />
        {can('operator') && <Route path="/rollouts/new" element={<NeedsProject><NewRollout /></NeedsProject>} />}
        <Route path="/rollouts/:id" element={<NeedsProject><RolloutDetail /></NeedsProject>} />
        {can('admin') && <Route path="/credentials" element={<Credentials />} />}
        <Route path="*" element={<Navigate to="/overview" replace />} />
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
            <DialogHost />
            <ToastHost />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
      </ErrorBoundary>
    </ThemeProvider>
  )
}
