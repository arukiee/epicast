/**
 * ResetPasswordPage.jsx — Set a new password from a forgot-password email link.
 */

import React, { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { resetPassword } from '../api.js'
import { motion } from 'framer-motion'
import { KeyRound, Eye, EyeOff, AlertCircle, CheckCircle2, Loader2, Activity } from 'lucide-react'

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const goToLogin = () => {
    localStorage.removeItem('epicast_token')
    localStorage.removeItem('epicast_user')
    navigate('/login?fresh=1')
  }

  useEffect(() => {
    localStorage.removeItem('epicast_token')
    localStorage.removeItem('epicast_user')
  }, [])

  const isLengthValid = password.length >= 6

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!token) {
      setError('Missing reset token. Request a new password reset link.')
      return
    }
    if (!isLengthValid) {
      setError('Password must be at least 6 characters long.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    try {
      await resetPassword(token, password)
      setSuccess(true)
    } catch (err) {
      const detail = err.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Failed to reset password. The link may be invalid or expired.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none">
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
          <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg">
            <Activity className="w-6 h-6 text-black" />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
          {success ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-100">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Password Updated</h2>
              <p className="text-gray-600 text-sm mb-8 leading-relaxed">
                Your password has been changed. You can now sign in with your new password.
              </p>
              <button type="button" onClick={goToLogin} className="w-full bg-black text-white font-medium py-3 rounded-lg hover:bg-gray-900 transition-colors">
                Sign In
              </button>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-100">
                  <KeyRound className="w-6 h-6 text-gray-700" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Reset Password</h2>
                <p className="text-gray-600 text-sm">Choose a new password for your EPICAST account.</p>
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-3 py-2.5 mb-5 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">New Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      required
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-3 pr-10 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black text-sm"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Confirm Password</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    required
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !isLengthValid || password !== confirmPassword}
                  className="w-full bg-black text-white font-medium py-3 rounded-lg hover:bg-gray-900 disabled:opacity-50 flex items-center justify-center gap-2 mt-6 text-sm"
                >
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Updating...</> : 'Update Password'}
                </button>
              </form>
            </>
          )}
        </div>
      </motion.div>
    </div>
  )
}
