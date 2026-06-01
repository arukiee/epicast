/**
 * App.jsx — Root router with role-based route protection
 */

import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

import LoginPage          from './pages/LoginPage.jsx'
import DashboardPage      from './pages/DashboardPage.jsx'
import ReportsPage        from './pages/ReportsPage.jsx'
import ForecastPage       from './pages/ForecastPage.jsx'
import AlertsPage         from './pages/AlertsPage.jsx'
import LogsPage           from './pages/LogsPage.jsx'
import UsersPage          from './pages/UsersPage.jsx'
import AccessRequestsPage from './pages/AccessRequestsPage.jsx'
import Layout             from './components/Layout.jsx'
import VerifyEmailPage    from './pages/VerifyEmailPage.jsx'
import SetupPasswordPage  from './pages/SetupPasswordPage.jsx'
import ResetPasswordPage  from './pages/ResetPasswordPage.jsx'

function ProtectedRoute({ children }) {
  const token = localStorage.getItem('epicast_token')
  return token ? children : <Navigate to="/login" replace />
}

function AdminRoute({ children }) {
  const user = JSON.parse(localStorage.getItem('epicast_user') || '{}')
  if (user.role !== 'admin') return <Navigate to="/dashboard" replace />
  return children
}

function ReporterRoute({ children }) {
  const user = JSON.parse(localStorage.getItem('epicast_user') || '{}')
  if (user.role === 'public_health_officer') return <Navigate to="/dashboard" replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/setup-password" element={<SetupPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index             element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"  element={<DashboardPage />} />
          <Route path="reports"    element={<ReporterRoute><ReportsPage /></ReporterRoute>} />
          <Route path="forecast"   element={<ForecastPage />} />
          <Route path="alerts"     element={<AlertsPage />} />
          <Route path="logs"            element={<AdminRoute><LogsPage /></AdminRoute>} />
          <Route path="users"           element={<AdminRoute><UsersPage /></AdminRoute>} />
          <Route path="access-requests" element={<AdminRoute><AccessRequestsPage /></AdminRoute>} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
