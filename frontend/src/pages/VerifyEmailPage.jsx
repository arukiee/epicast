/**
 * VerifyEmailPage.jsx — User landing page for verifying email access requests.
 */

import React, { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { verifyEmail } from '../api.js'
import { motion } from 'framer-motion'
import { ShieldCheck, ShieldAlert, Loader2, ArrowRight, Activity } from 'lucide-react'

// Dedupe only in-flight verify calls (StrictMode), not completed results.
const verifyInFlightByToken = new Map()

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token')
  
  const [status, setStatus] = useState('verifying') // verifying | success | error | already_active
  const [message, setMessage] = useState('')
  const [setupToken, setSetupToken] = useState(null)

  const goToLogin = () => {
    localStorage.removeItem('epicast_token')
    localStorage.removeItem('epicast_user')
    navigate('/login?fresh=1')
  }

  useEffect(() => {
    // Onboarding links are for the new account — do not keep another user's session.
    localStorage.removeItem('epicast_token')
    localStorage.removeItem('epicast_user')

    if (!token) {
      setStatus('error')
      setMessage('Invalid verification link. Missing token.')
      return
    }

    let request = verifyInFlightByToken.get(token)
    if (!request) {
      request = verifyEmail(token)
        .then((response) => ({ ok: true, data: response.data }))
        .catch((err) => ({ ok: false, err }))
        .finally(() => verifyInFlightByToken.delete(token))
      verifyInFlightByToken.set(token, request)
    }

    let cancelled = false
    request.then((result) => {
      if (cancelled) return
      if (result.ok) {
        if (result.data?.already_completed) {
          setStatus('already_active')
          setMessage(result.data?.message || 'This account is already active. Please sign in.')
          return
        }
        setStatus('success')
        setMessage(result.data?.message || 'Email verified successfully. Your request is now in the review queue.')
        if (result.data?.setup_token) {
          setSetupToken(result.data.setup_token)
        }
      } else {
        setStatus('error')
        const detail = result.err.response?.data?.detail
        setMessage(typeof detail === 'string' ? detail : 'Verification failed or link expired.')
      }
    })

    return () => {
      cancelled = true
    }
  }, [token])

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background radial grid */}
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
          {status === 'verifying' && (
            <div className="text-center py-6">
              <Loader2 className="w-12 h-12 text-black animate-spin mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Verifying your email</h2>
              <p className="text-gray-500 text-sm">
                Validating your access request token with EPICAST security servers...
              </p>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center">
              <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-100">
                <ShieldCheck className="w-8 h-8 text-emerald-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                {setupToken ? 'Email Verified' : 'Request Verified'}
              </h2>
              <p className="text-gray-600 text-sm mb-8 leading-relaxed">
                {message}
              </p>
              {setupToken ? (
                <button
                  type="button"
                  onClick={() => navigate(`/setup-password?token=${setupToken}`)}
                  className="w-full bg-black text-white font-medium py-3 rounded-lg hover:bg-gray-900 transition-colors flex items-center justify-center gap-2"
                >
                  Set Up Your Password
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={goToLogin}
                  className="w-full bg-black text-white font-medium py-3 rounded-lg hover:bg-gray-900 transition-colors flex items-center justify-center gap-2"
                >
                  Go to Sign In
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {status === 'already_active' && (
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-100">
                <ShieldCheck className="w-8 h-8 text-blue-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Account Already Active</h2>
              <p className="text-gray-600 text-sm mb-8 leading-relaxed">
                {message}
              </p>
              <button
                type="button"
                onClick={goToLogin}
                className="w-full bg-black text-white font-medium py-3 rounded-lg hover:bg-gray-900 transition-colors flex items-center justify-center gap-2"
              >
                Sign In
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center">
              <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-rose-100">
                <ShieldAlert className="w-8 h-8 text-rose-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Verification Failed</h2>
              <p className="text-rose-700 bg-rose-50/50 border border-rose-100 rounded-lg p-3 text-sm mb-8 leading-relaxed">
                {message}
              </p>
              <button
                type="button"
                onClick={goToLogin}
                className="w-full border border-gray-200 text-gray-700 font-medium py-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Return to Login
              </button>
            </div>
          )}
        </div>

        <div className="text-center mt-8">
          <p className="text-xs text-gray-500">EPICAST Outbreak Surveillance Hub</p>
        </div>
      </motion.div>
    </div>
  )
}
