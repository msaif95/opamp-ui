import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthProvider'
import { LoginPage } from './auth/LoginPage'
import { Layout } from './components/Layout'
import { AgentDetail } from './features/agent-detail/AgentDetail'
import { Credentials } from './features/credentials/Credentials'
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
        <Route path="/agents/:uid" element={<AgentDetail />} />
        {can('admin') && <Route path="/credentials" element={<Credentials />} />}
        <Route path="*" element={<Navigate to="/agents" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Shell />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
