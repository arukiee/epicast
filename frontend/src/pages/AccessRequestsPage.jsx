/**
 * AccessRequestsPage.jsx — Admin inbox + onboarding activation approval workflow
 */

import React, { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  getAccessRequests,
  approveAccessRequest,
  rejectAccessRequest,
} from '../api.js'
import {
  PROVISION_ROLES,
  HYD_AREAS,
  CLINICS_BY_AREA,
  suggestUsernameFromEmail,
} from '../constants/hyderabadUserForm.js'
import {
  Inbox,
  RefreshCw,
  Lock,
  Mail,
  Building2,
  User,
  Search,
  UserPlus,
  X,
  CheckCircle,
  AlertCircle,
  XCircle,
  Clock,
  ThumbsDown,
} from 'lucide-react'

const BLANK_PROVISION = {
  username: '',
  role: 'clinic_staff',
  assigned_area: '',
  assigned_clinic: '',
  full_name: '',
  email: '',
}

export default function AccessRequestsPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [queueTab, setQueueTab] = useState('verified') // verified | pending | active | rejected | all
  const [provisionFor, setProvisionFor] = useState(null)
  const [pForm, setPForm] = useState(BLANK_PROVISION)
  const [pSubmitting, setPSubmitting] = useState(false)
  const [pError, setPError] = useState('')
  const [toast, setToast] = useState(null)

  const fetchRows = async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await getAccessRequests()
      setRows(data)
    } catch (err) {
      const status = err.response?.status
      const detail = err.response?.data?.detail
      if (status === 403) {
        setError('Access denied — administrators only.')
      } else if (status === 401) {
        setError(typeof detail === 'string' ? detail : 'Session invalid. Please sign in again.')
      } else {
        setError('Failed to load access requests.')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRows()
  }, [])

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 10000)
  }

  const openApproval = (row) => {
    setPError('')
    setProvisionFor(row)
    setPForm({
      ...BLANK_PROVISION,
      full_name: row.full_name || '',
      email: row.email || '',
      username: suggestUsernameFromEmail(row.email),
      role: 'clinic_staff',
    })
  }

  const closeApproval = () => {
    setProvisionFor(null)
    setPForm(BLANK_PROVISION)
    setPError('')
  }

  const handleApproveSubmit = async (e) => {
    e.preventDefault()
    setPError('')
    if (!pForm.username.trim()) {
      setPError('Username is required.')
      return
    }
    setPSubmitting(true)
    try {
      const { data } = await approveAccessRequest(provisionFor.id, {
        username: pForm.username.trim(),
        role: pForm.role,
        assigned_area: pForm.assigned_area,
        assigned_clinic: pForm.assigned_clinic,
      })
      if (data.setup_url) {
        // Email failed — account created directly, show setup link to admin
        const copied = await navigator.clipboard.writeText(data.setup_url).then(() => true).catch(() => false)
        showToast(
          `Account "${data.username}" created! Setup link ${copied ? 'copied to clipboard' : 'shown below'}. Share it with the user so they can set their password.`,
          'success',
        )
        if (!copied) {
          window.prompt('Copy this setup link and share it with the user:', data.setup_url)
        }
      } else {
        showToast(`Access request approved. Verification email sent to ${provisionFor.email}.`)
      }
      closeApproval()
      fetchRows()
    } catch (err) {
      const d = err.response?.data?.detail
      setPError(typeof d === 'string' ? d : 'Could not approve request. Ensure username is unique.')
    } finally {
      setPSubmitting(false)
    }
  }

  const handleReject = async (id) => {
    if (!window.confirm('Are you sure you want to reject this request? This will mark it as rejected.')) return
    try {
      await rejectAccessRequest(id)
      showToast('Access request rejected.', 'success')
      fetchRows()
    } catch (err) {
      const d = err.response?.data?.detail
      showToast(typeof d === 'string' ? d : 'Failed to reject request.', 'error')
    }
  }

  const availableClinics = CLINICS_BY_AREA[pForm.assigned_area] || []

  // Normalization logic for backward compatibility
  const getRequestStatus = (r) => {
    if (r.status) return r.status
    return r.provisioned_username ? 'active' : 'pending_approval'
  }

  const q = search.trim().toLowerCase()
  const searched = useMemo(() => {
    if (!q) return rows
    return rows.filter((r) =>
      [r.full_name, r.email, r.organization, r.use_case, r.provisioned_username]
        .join(' ')
        .toLowerCase()
        .includes(q),
    )
  }, [rows, q])

  // Split rows by status
  const verifiedRows = useMemo(() => searched.filter((r) => {
    const s = getRequestStatus(r)
    return s === 'pending_approval' || s === 'verified'
  }), [searched])
  const pendingRows = useMemo(() => searched.filter((r) => getRequestStatus(r) === 'pending_verification'), [searched])
  const activeRows = useMemo(() => searched.filter((r) => getRequestStatus(r) === 'active'), [searched])
  const rejectedRows = useMemo(() => searched.filter((r) => getRequestStatus(r) === 'rejected'), [searched])

  const list = useMemo(() => {
    if (queueTab === 'verified') return verifiedRows
    if (queueTab === 'pending') return pendingRows
    if (queueTab === 'active') return activeRows
    if (queueTab === 'rejected') return rejectedRows
    return searched
  }, [queueTab, verifiedRows, pendingRows, activeRows, rejectedRows, searched])

  const renderStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return (
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <CheckCircle className="w-3 h-3" /> Active
          </span>
        )
      case 'pending_verification':
        return (
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <Clock className="w-3 h-3" /> Awaiting Verification
          </span>
        )
      case 'pending_approval':
      case 'verified':
        return (
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 border border-blue-500/20 text-blue-400">
            <Inbox className="w-3 h-3" /> Pending Review
          </span>
        )
      case 'rejected':
        return (
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 border border-rose-500/20 text-rose-400">
            <XCircle className="w-3 h-3" /> Rejected
          </span>
        )
      case 'expired':
        return (
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-500/10 border border-slate-500/20 text-slate-400">
            <Clock className="w-3 h-3" /> Expired
          </span>
        )
      default:
        return (
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-500/10 border border-slate-500/20 text-slate-400">
            {status}
          </span>
        )
    }
  }

  return (
    <div className="space-y-6 fade-in relative">
      {toast && (
        <div
          className={`fixed top-4 right-4 z-[60] flex items-center gap-2 px-5 py-3 rounded-xl shadow-2xl text-sm font-medium
          ${toast.type === 'success'
            ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
            : 'bg-red-500/20 border border-red-500/40 text-red-300'}`}
        >
          {toast.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Access Requests</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Review new requests, then <strong className="text-gray-700">Approve</strong> to email a verification link. After the user verifies, they set a password to activate their account.
            {' '}
            <Link to="/users" className="text-brand-600 hover:underline">Open full Users directory</Link>
          </p>
        </div>
        <button
          type="button"
          onClick={fetchRows}
          className="p-2.5 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 text-indigo-800 rounded-xl px-4 py-2.5 text-xs">
        <Lock className="w-3.5 h-3.5 flex-shrink-0" />
        Security Notice: Approvals automatically trigger account activation and send secure setup tokens directly to the user's inbox.
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          <Lock className="w-4 h-4" />
          {error}
        </div>
      )}

      {!error && (
        <>
          <div className="flex flex-col xl:flex-row gap-3 xl:items-center xl:justify-between">
            <div className="flex flex-wrap rounded-xl border border-gray-200 p-0.5 bg-gray-100/50 w-fit">
              <button
                type="button"
                onClick={() => setQueueTab('verified')}
                className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition ${
                  queueTab === 'verified'
                    ? 'bg-brand-600 text-white shadow'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Pending Review ({verifiedRows.length})
              </button>
              <button
                type="button"
                onClick={() => setQueueTab('pending')}
                className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition ${
                  queueTab === 'pending'
                    ? 'bg-brand-600 text-white shadow'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Awaiting Verify ({pendingRows.length})
              </button>
              <button
                type="button"
                onClick={() => setQueueTab('active')}
                className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition ${
                  queueTab === 'active'
                    ? 'bg-brand-600 text-white shadow'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Active ({activeRows.length})
              </button>
              <button
                type="button"
                onClick={() => setQueueTab('rejected')}
                className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition ${
                  queueTab === 'rejected'
                    ? 'bg-brand-600 text-white shadow'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Rejected ({rejectedRows.length})
              </button>
              <button
                type="button"
                onClick={() => setQueueTab('all')}
                className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition ${
                  queueTab === 'all'
                    ? 'bg-brand-600 text-white shadow'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                All ({searched.length})
              </button>
            </div>
            <div className="glass p-2 flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search requests…"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                />
              </div>
            </div>
          </div>

          <div className="glass p-5">
            <div className="flex items-center gap-2 mb-4">
              <Inbox className="w-4 h-4 text-brand-500" />
              <h2 className="font-semibold text-gray-900 text-sm">
                {queueTab === 'verified' && 'Pending Review Requests'}
                {queueTab === 'pending' && 'Awaiting Verification'}
                {queueTab === 'active' && 'Activated Accounts'}
                {queueTab === 'rejected' && 'Rejected Submissions'}
                {queueTab === 'all' && 'All Request Archives'}
              </h2>
              <span className="text-xs text-gray-400 ml-1">({list.length})</span>
            </div>

            {loading ? (
              <div className="flex justify-center py-16">
                <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : list.length === 0 ? (
              <p className="text-center text-gray-400 py-10 text-sm">
                No access requests matched your current criteria.
              </p>
            ) : (
              <div className="space-y-4">
                {list.map((r) => {
                  const currentStatus = getRequestStatus(r)
                  return (
                    <div
                      key={r.id}
                      className={`rounded-xl border p-4 text-sm transition ${
                        currentStatus === 'active'
                          ? 'border-emerald-100 bg-emerald-50/20 text-gray-700'
                          : 'border-gray-200 bg-gray-50/50 hover:bg-gray-50/80 text-gray-700'
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {(r.full_name || '?')[0].toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-gray-900 truncate flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                              {r.full_name}
                            </div>
                            <div className="text-xs text-gray-400 mt-0.5">
                              Submitted: {new Date(r.created_at).toLocaleString('en-IN')}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span className="text-xs text-gray-400 font-mono">#{r.id}</span>
                          {renderStatusBadge(currentStatus)}
                          {(currentStatus === 'pending_approval' || currentStatus === 'verified') && (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => openApproval(r)}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium transition shadow-lg shadow-brand-600/20"
                              >
                                <UserPlus className="w-3.5 h-3.5" />
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => handleReject(r.id)}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:text-gray-800 hover:bg-gray-100 text-xs font-medium transition"
                                title="Reject Request"
                              >
                                <ThumbsDown className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {currentStatus === 'active' && r.provisioned_username ? (
                        <div className="text-xs text-emerald-700 flex items-center gap-1.5 mb-3">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                          Activated as <span className="font-mono text-emerald-800 font-semibold">{r.provisioned_username}</span>
                          {r.provisioned_at && (
                            <span className="text-gray-400">
                              · Approved on {new Date(r.provisioned_at).toLocaleString('en-IN')}
                            </span>
                          )}
                        </div>
                      ) : null}

                      <div className="space-y-2 text-gray-600">
                        <div className="flex items-start gap-2">
                          <Mail className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                          <a href={`mailto:${r.email}`} className="text-brand-600 hover:underline break-all">
                            {r.email}
                          </a>
                        </div>
                        <div className="flex items-start gap-2">
                          <Building2 className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                          <span>{r.organization}</span>
                        </div>
                        {r.use_case ? (
                          <p className="text-gray-500 text-xs leading-relaxed pl-6 border-l border-gray-200 ml-1">
                            {r.use_case}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}

      {provisionFor && (
        <div
          className="fixed inset-0 z-[55] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="provision-title"
          onClick={(e) => e.target === e.currentTarget && !pSubmitting && closeApproval()}
        >
          <div
            className="bg-white border border-gray-200 rounded-2xl shadow-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 id="provision-title" className="text-lg font-semibold text-gray-900">
                  Approve Access Request
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  Request #{provisionFor.id} · {provisionFor.organization}
                </p>
              </div>
              <button
                type="button"
                disabled={pSubmitting}
                onClick={closeApproval}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-40"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {pError && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2 mb-4 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {pError}
              </div>
            )}

            <form onSubmit={handleApproveSubmit} className="space-y-4">
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-600 space-y-1.5">
                <p className="font-semibold text-gray-900">Approve Details:</p>
                <p><span className="text-gray-400">Full Name:</span> {provisionFor.full_name}</p>
                <p><span className="text-gray-400">Email:</span> {provisionFor.email}</p>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Username</label>
                <input
                  value={pForm.username}
                  onChange={(e) => setPForm({ ...pForm, username: e.target.value })}
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all"
                  placeholder="login id"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Role</label>
                <select
                  value={pForm.role}
                  onChange={(e) => setPForm({ ...pForm, role: e.target.value, assigned_clinic: '' })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all"
                >
                  {PROVISION_ROLES.map((ro) => (
                     <option key={ro.value} value={ro.value}>
                      {ro.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-1">Assigned area</label>
                <select
                  value={pForm.assigned_area}
                  onChange={(e) => setPForm({ ...pForm, assigned_area: e.target.value, assigned_clinic: '' })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all"
                >
                  <option value="">— None —</option>
                  {HYD_AREAS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>

              {['clinic_staff', 'hospital_staff'].includes(pForm.role) && (
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Assigned clinic</label>
                  <select
                    value={pForm.assigned_clinic}
                    onChange={(e) => setPForm({ ...pForm, assigned_clinic: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all"
                  >
                    <option value="">— None —</option>
                    {availableClinics.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  {!pForm.assigned_area && (
                    <p className="text-[11px] text-gray-400 mt-1">Pick an area to list clinics.</p>
                  )}
                </div>
              )}

              <div className="bg-indigo-50 border border-indigo-100 text-indigo-800 rounded-xl px-3.5 py-3 text-xs leading-relaxed">
                ℹ️ An automated verification email will be sent to <strong>{provisionFor.email}</strong>. Once the user verifies their email, their account will be created and they will configure their password.
              </div>

              <div className="flex flex-wrap gap-2 justify-end pt-3 border-t border-gray-150">
                <button
                  type="button"
                  disabled={pSubmitting}
                  onClick={closeApproval}
                  className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium disabled:opacity-50 flex items-center gap-2 transition-all"
                >
                  {pSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Approving…
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      Approve &amp; send verification email
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
