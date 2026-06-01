/**
 * api.js — Centralised Axios instance + typed API helpers
 */

import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
  timeout: 30000,
})

let refreshPromise = null
let refreshQueue = []

const AUTH_NO_REFRESH_PATHS = [
  '/login',
  '/refresh',
  '/request-demo',
  '/auth/verify-email',
  '/auth/setup-password',
  '/auth/forgot-password',
  '/auth/reset-password',
]

const shouldSkipTokenRefresh = (config) =>
  AUTH_NO_REFRESH_PATHS.some((path) => config?.url?.includes(path))

const processRefreshQueue = (error, token = null) => {
  refreshQueue.forEach((callback) => callback(error, token))
  refreshQueue = []
}

/** Refresh access token once; concurrent callers share the same promise. */
export const refreshAccessToken = () => {
  if (!refreshPromise) {
    refreshPromise = api
      .post('/refresh')
      .then((response) => {
        const newToken = response.data.access_token
        localStorage.setItem('epicast_token', newToken)
        processRefreshQueue(null, newToken)
        return newToken
      })
      .catch((error) => {
        processRefreshQueue(error, null)
        throw error
      })
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

/** Call after login or before protected routes load to avoid stale-token 401 bursts. */
export const ensureSession = async () => {
  const token = localStorage.getItem('epicast_token')
  if (!token) return null
  return refreshAccessToken()
}

api.interceptors.request.use((config) => {
  const isPublicAuth = shouldSkipTokenRefresh(config)
  if (isPublicAuth) {
    delete config.headers.Authorization
  } else {
    const token = localStorage.getItem('epicast_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !shouldSkipTokenRefresh(originalRequest)
    ) {
      originalRequest._retry = true

      if (refreshPromise) {
        return new Promise((resolve, reject) => {
          refreshQueue.push((err, token) => {
            if (err) {
              reject(err)
            } else {
              originalRequest.headers.Authorization = `Bearer ${token}`
              resolve(api(originalRequest))
            }
          })
        })
      }

      try {
        const newToken = await refreshAccessToken()
        originalRequest.headers.Authorization = `Bearer ${newToken}`
        return api(originalRequest)
      } catch (refreshError) {
        localStorage.removeItem('epicast_token')
        localStorage.removeItem('epicast_user')
        if (!window.location.pathname.startsWith('/login')) {
          window.location.href = '/login'
        }
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  }
)

// ── Auth ──────────────────────────────────────────────────────────────────────
export const login = (email, password) => api.post('/login', { email, password })
export const refreshSession = () => api.post('/refresh')
export const logout = () => api.post('/logout')
export const checkRequestEmail = (email) =>
  api.get('/request-demo/check-email', { params: { email: email.trim() } })
export const requestDemoAccess = (payload) => api.post('/request-demo', payload)
export const forgotPassword = (payload) => api.post('/auth/forgot-password', payload)
export const getRolePreviews = () => api.get('/auth/roles')
export const getMe = () => api.get('/me')

export const getAccessRequests = () => api.get('/admin/access-requests')
export const markAccessRequestProvisioned = (id, provisionedUsername) =>
  api.patch(`/admin/access-requests/${id}`, { provisioned_username: provisionedUsername })
export const verifyEmail = (token) => api.post('/auth/verify-email', { token })
export const setupPassword = (token, password) => api.post('/auth/setup-password', { token, password })
export const resetPassword = (token, password) => api.post('/auth/reset-password', { token, password })
export const approveAccessRequest = (id, payload) => api.post(`/admin/access-requests/${id}/approve`, payload)
export const rejectAccessRequest = (id) => api.post(`/admin/access-requests/${id}/reject`)

// ── Admin: User management ────────────────────────────────────────────────────
export const getUsers    = ()           => api.get('/admin/users')
export const createUser  = (data)       => api.post('/admin/users', data)
export const updateUser  = (id, data)   => api.patch(`/admin/users/${id}`, data)
export const deleteUser  = (id)         => api.delete(`/admin/users/${id}`)

// ── Reports ───────────────────────────────────────────────────────────────────
export const getReports  = ()     => api.get('/reports')
export const reportCase  = (data) => api.post('/report_case',  data)
export const reportDeath = (data) => api.post('/report_death', data)

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const getDashboardStats  = ()            => api.get('/dashboard/stats')
export const getDashboardZones  = (params = {}) => api.get('/dashboard/zones',  { params })
export const getDashboardAlerts = ()            => api.get('/dashboard/alerts')
export const getAreaSummary     = ()            => api.get('/dashboard/areas')
export const getForecast        = (disease)     => api.get(`/dashboard/forecast/${encodeURIComponent(disease)}`)

// ── Alerts ────────────────────────────────────────────────────────────────────
export const acknowledgeAlert = (id) => api.post(`/alerts/${id}/acknowledge`)
export const syncAlerts       = ()   => api.post('/alerts/sync')

// ── Logs ──────────────────────────────────────────────────────────────────────
export const getLogs = () => api.get('/logs')

// ── Surveillance Observations (data-derived, from DB) ────────────────────────
export const getObservations   = ()           => api.get('/intel/ai-insights')
export const getResourceStress = ()           => api.get('/intel/resource-stress')

export default api
