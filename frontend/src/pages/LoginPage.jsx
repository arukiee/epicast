/**
 * LoginPage.jsx — Minimal modern authentication (email/username + password)
 */

import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { login, requestDemoAccess, checkRequestEmail, forgotPassword } from '../api.js'
import { motion } from 'framer-motion'
import {
  Activity, Lock, Mail, AlertCircle, Eye, EyeOff, ArrowRight, User, Building2, Send
} from 'lucide-react'

const LoadingSpinner = () => (
  <div className="flex items-center justify-center gap-2">
    <div className="w-1 h-1 bg-white rounded-full animate-pulse" />
    <div className="w-1 h-1 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.1s' }} />
    <div className="w-1 h-1 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
  </div>
)

const BLANK_ACCESS = { full_name: '', email: '', organization: '', use_case: '' }

const RequestAccessModal = ({ isOpen, onClose, getErrorMessage }) => {
  const [form, setForm] = useState(BLANK_ACCESS)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [emailCheck, setEmailCheck] = useState({
    status: 'idle',
    message: '',
    mx_found: false,
    check_method: '',
  })
  const emailCheckSeq = useRef(0)

  const reset = () => {
    setForm(BLANK_ACCESS)
    setError('')
    setSuccessMsg('')
    setSubmitting(false)
    setEmailCheck({ status: 'idle', message: '', mx_found: false, check_method: '' })
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  useEffect(() => {
    const email = form.email.trim()
    const looksComplete = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    if (!looksComplete) {
      setEmailCheck({ status: 'idle', message: '', mx_found: false, check_method: '' })
      return undefined
    }

    const seq = ++emailCheckSeq.current
    setEmailCheck({ status: 'checking', message: '', mx_found: false, check_method: '' })
    const timer = setTimeout(async () => {
      try {
        const { data } = await checkRequestEmail(email)
        if (seq !== emailCheckSeq.current) return
        if (!data.deliverable || !data.mx_found) {
          const detail = !data.syntax_valid
            ? 'Invalid email format.'
            : data.syntax_valid && !data.mx_found
              ? 'DNS found no mail server (MX) for this domain.'
              : data.message || 'This email cannot receive mail.'
          setEmailCheck({
            status: 'undeliverable',
            message: data.message || detail,
            mx_found: false,
            check_method: data.check_method || 'dns_mx',
          })
        } else if (data.available) {
          setEmailCheck({
            status: 'ok',
            message: data.message || 'This email address looks valid.',
            mx_found: true,
            check_method: data.check_method || 'dns_mx',
          })
        } else {
          setEmailCheck({
            status: 'taken',
            message: data.message || 'This email cannot be used for a new request.',
            mx_found: Boolean(data.mx_found),
            check_method: data.check_method || '',
          })
        }
      } catch {
        if (seq !== emailCheckSeq.current) return
        setEmailCheck({ status: 'idle', message: '', mx_found: false, check_method: '' })
      }
    }, 450)

    return () => clearTimeout(timer)
  }, [form.email])

  if (!isOpen) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.full_name.trim() || !form.email.trim() || !form.organization.trim()) {
      setError('Please enter your name, work email, and organization.')
      return
    }
    if (emailCheck.status === 'checking') {
      setError('Please wait while we check your email address.')
      return
    }
    if (emailCheck.status === 'taken') {
      setError(emailCheck.message || 'This email is already in use.')
      return
    }
    if (emailCheck.status === 'undeliverable') {
      setError(emailCheck.message || 'This email cannot receive mail.')
      return
    }
    if (emailCheck.status !== 'ok' || !emailCheck.mx_found) {
      setError('Wait for email validation to finish, or fix the email address above.')
      return
    }
    setSubmitting(true)
    try {
      const { data } = await requestDemoAccess({
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        organization: form.organization.trim(),
        use_case: form.use_case.trim() || '',
      })
      setSuccessMsg(data?.message || 'Your request was sent. We will follow up by email.')
      setForm(BLANK_ACCESS)
    } catch (err) {
      setError(getErrorMessage(err, 'Could not submit your request. Try again later.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="request-access-title"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        {successMsg ? (
          <div className="text-center">
            <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Send className="w-6 h-6 text-emerald-600" />
            </div>
            <h3 id="request-access-title" className="text-lg font-semibold text-gray-900 mb-2">Request received</h3>
            <p className="text-gray-600 text-sm mb-6">{successMsg}</p>
            <button
              type="button"
              onClick={handleClose}
              className="w-full bg-black text-white font-medium py-3 rounded-lg hover:bg-gray-900 transition-colors"
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <>
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Lock className="w-6 h-6 text-gray-600" />
              </div>
              <h3 id="request-access-title" className="text-lg font-semibold text-gray-900 mb-2">Request access</h3>
              <p className="text-gray-600 text-sm">
                EPICAST accounts are provisioned by your organization. Submit this form and our team will contact you at your work email.
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4 text-sm text-red-700">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Full name</label>
                <div className="relative mt-1">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    autoComplete="name"
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    placeholder="Dr. Jane Smith"
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-10 pr-3 py-2.5 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Work email</label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    autoComplete="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="you@hospital.org"
                    className={`w-full bg-gray-50 border rounded-lg pl-10 pr-3 py-2.5 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent text-sm ${
                      emailCheck.status === 'taken' ? 'border-red-300' : 'border-gray-200'
                    }`}
                  />
                </div>
                {emailCheck.status === 'checking' && (
                  <p className="text-xs text-gray-500 mt-1">Checking email…</p>
                )}
                {emailCheck.status === 'undeliverable' && (
                  <p className="text-xs text-red-600 mt-1">{emailCheck.message}</p>
                )}
                {emailCheck.status === 'taken' && (
                  <p className="text-xs text-red-600 mt-1">{emailCheck.message}</p>
                )}
                {emailCheck.status === 'ok' && emailCheck.message && (
                  <p className="text-xs text-emerald-600 mt-1">{emailCheck.message}</p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Organization</label>
                <div className="relative mt-1">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    autoComplete="organization"
                    value={form.organization}
                    onChange={(e) => setForm({ ...form, organization: e.target.value })}
                    placeholder="Hospital or health department name"
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-10 pr-3 py-2.5 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">How will you use EPICAST? <span className="text-gray-400 font-normal">(optional)</span></label>
                <textarea
                  value={form.use_case}
                  onChange={(e) => setForm({ ...form, use_case: e.target.value })}
                  placeholder="e.g. outbreak reporting for our district clinics"
                  rows={3}
                  className="w-full mt-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent text-sm resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 py-3 rounded-lg border border-gray-200 text-gray-700 font-medium text-sm hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    submitting
                    || emailCheck.status === 'checking'
                    || emailCheck.status === 'taken'
                    || emailCheck.status === 'undeliverable'
                    || !emailCheck.mx_found
                    || emailCheck.status !== 'ok'
                  }
                  className="flex-1 bg-black text-white font-medium py-3 rounded-lg hover:bg-gray-900 disabled:opacity-50 text-sm transition-colors flex items-center justify-center gap-2"
                >
                  {submitting ? <LoadingSpinner /> : <>Submit request <Send className="w-4 h-4" /></>}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

const ForgotPasswordModal = ({ isOpen, onClose, getErrorMessage, defaultIdentifier = '' }) => {
  const [identifier, setIdentifier] = useState(defaultIdentifier)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => {
    if (isOpen) {
      setIdentifier(defaultIdentifier)
      setError('')
      setSuccessMsg('')
      setSubmitting(false)
    }
  }, [isOpen, defaultIdentifier])

  if (!isOpen) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const trimmed = identifier.trim()
    if (!trimmed) {
      setError('Enter your email or username.')
      return
    }
    setSubmitting(true)
    try {
      const { data } = await forgotPassword({ identifier: trimmed })
      let msg = data?.message || 'If this account exists, you will receive reset instructions shortly.'
      if (data?.dev_reset_url) {
        msg += ` Dev link: ${data.dev_reset_url}`
      }
      setSuccessMsg(msg)
    } catch (err) {
      setError(getErrorMessage(err, 'Could not process your request. Try again later.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="forgot-password-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        {successMsg ? (
          <div className="text-center">
            <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-6 h-6 text-emerald-600" />
            </div>
            <h3 id="forgot-password-title" className="text-lg font-semibold text-gray-900 mb-2">Check your email</h3>
            <p className="text-gray-600 text-sm mb-6">{successMsg}</p>
            <button
              type="button"
              onClick={onClose}
              className="w-full bg-black text-white font-medium py-3 rounded-lg hover:bg-gray-900 transition-colors"
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <>
            <div className="text-center mb-6">
              <h3 id="forgot-password-title" className="text-lg font-semibold text-gray-900 mb-2">Reset password</h3>
              <p className="text-gray-600 text-sm">
                Enter the same email or username you use to sign in. We will email reset instructions if the account exists.
              </p>
            </div>
            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4 text-sm text-red-700">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Email or username</label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    autoComplete="username"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="admin or you@hospital.org"
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-10 pr-3 py-2.5 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent text-sm"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 rounded-lg border border-gray-200 text-gray-700 font-medium text-sm hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-black text-white font-medium py-3 rounded-lg hover:bg-gray-900 disabled:opacity-50 text-sm transition-colors flex items-center justify-center gap-2"
                >
                  {submitting ? <LoadingSpinner /> : 'Send reset link'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

export default function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const skipAutoRedirect = searchParams.get('fresh') === '1'
  const [form, setForm] = useState({ identifier: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showRequestAccessModal, setShowRequestAccessModal] = useState(false)
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false)

  useEffect(() => {
    // After onboarding links, stay on login so the user can sign in as themselves.
    if (skipAutoRedirect) return
    // Validate the stored token before redirecting — clears stale/expired tokens
    const token = localStorage.getItem('epicast_token')
    if (!token) return
    import('../api.js').then(({ default: api }) => {
      api.get('/dashboard/stats')
        .then(() => navigate('/dashboard'))
        .catch(() => {
          // Token invalid (e.g. DB was reset) — clear it and stay on login
          localStorage.removeItem('epicast_token')
          localStorage.removeItem('epicast_user')
        })
    })
  }, [navigate, skipAutoRedirect])

  const getErrorMessage = (err, fallback) => {
    const detail = err?.response?.data?.detail
    if (!detail) return fallback
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail)) {
      return detail
        .map((item) => {
          if (typeof item === 'string') return item
          if (item?.msg) {
            const path = Array.isArray(item.loc) ? item.loc.join(' > ') : ''
            return path ? `${item.msg} (${path})` : item.msg
          }
          return JSON.stringify(item)
        })
        .join(' • ')
    }
    if (typeof detail === 'object') return JSON.stringify(detail)
    return fallback
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.identifier || !form.password) {
      setError('Please enter your email or username and password')
      return
    }
    setLoading(true)
    try {
      // Clear stale session so a failed login does not trigger refresh retries.
      localStorage.removeItem('epicast_token')
      localStorage.removeItem('epicast_user')
      const { data } = await login(form.identifier, form.password)
      localStorage.setItem('epicast_token', data.access_token)
      localStorage.setItem('epicast_user', JSON.stringify({
        username: data.username,
        role: data.role,
        role_label: data.role_label,
        assigned_clinic: data.assigned_clinic || '',
        assigned_area: data.assigned_area || '',
        full_name: data.full_name || '',
      }))
      navigate('/dashboard')
    } catch (err) {
      if (err.code === 'ECONNABORTED') {
        setError('Login timed out. Check that the backend is running and try again.')
      } else {
        setError(getErrorMessage(err, 'Login failed'))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="absolute inset-0 opacity-[0.02]">
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)',
          backgroundSize: '20px 20px'
        }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="flex justify-center mb-8">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg"
          >
            <Activity className="w-6 h-6 text-black" />
          </motion.div>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl shadow-black/10 p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">Welcome back</h1>
            <p className="text-gray-600 text-sm">Sign in to EPICAST</p>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-6"
            >
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <span className="text-sm text-red-700">{error}</span>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Email or username</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  autoComplete="username"
                  value={form.identifier}
                  onChange={e => setForm({ ...form, identifier: e.target.value })}
                  placeholder="you@example.com or username"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-10 pr-4 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  placeholder="Enter your password"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-10 pr-12 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: loading ? 1 : 1.02 }}
              whileTap={{ scale: loading ? 1 : 0.98 }}
              className="w-full bg-black text-white font-medium py-3 rounded-lg hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <LoadingSpinner />
              ) : (
                <>
                  Sign in
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </motion.button>
          </form>

          <div className="mt-8 space-y-4">
            <button
              type="button"
              onClick={() => setShowForgotPasswordModal(true)}
              className="w-full text-center text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              Forgot password?
            </button>
            <div className="text-center space-y-2">
              <p className="text-sm text-gray-600">New to EPICAST?</p>
              <button
                type="button"
                onClick={() => setShowRequestAccessModal(true)}
                className="text-sm font-medium text-black hover:underline"
              >
                Request access
              </button>
            </div>
          </div>
        </div>

        <div className="text-center mt-8">
          <p className="text-xs text-gray-500">EPICAST v4.0</p>
        </div>
      </motion.div>

      <RequestAccessModal
        isOpen={showRequestAccessModal}
        onClose={() => setShowRequestAccessModal(false)}
        getErrorMessage={getErrorMessage}
      />
      <ForgotPasswordModal
        isOpen={showForgotPasswordModal}
        onClose={() => setShowForgotPasswordModal(false)}
        getErrorMessage={getErrorMessage}
        defaultIdentifier={form.identifier}
      />
    </div>
  )
}
