/**
 * UsersPage.jsx — Admin-only user management: create, view, edit, delete users
 */

import React, { useEffect, useState } from 'react'
import { getUsers, createUser, updateUser, deleteUser } from '../api.js'
import { Users, Plus, X, Pencil, Trash2, RefreshCw, CheckCircle, AlertCircle, Lock, Shield } from 'lucide-react'
import { PROVISION_ROLES as ROLES, HYD_AREAS, CLINICS_BY_AREA } from '../constants/hyderabadUserForm.js'

const BLANK = { username:'', password:'', role:'clinic_staff', assigned_area:'', assigned_clinic:'', full_name:'', email:'' }

const ROLE_COLOURS = {
  admin:                 'bg-red-50 text-red-700 border-red-200',
  hospital_staff:        'bg-blue-50 text-blue-700 border-blue-200',
  clinic_staff:          'bg-violet-50 text-violet-700 border-violet-200',
  public_health_officer: 'bg-green-50 text-green-700 border-green-200',
}

export default function UsersPage() {
  const [users,      setUsers]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [showForm,   setShowForm]   = useState(false)
  const [editUser,   setEditUser]   = useState(null)   // user object being edited
  const [form,       setForm]       = useState(BLANK)
  const [submitting, setSubmitting] = useState(false)
  const [toast,      setToast]      = useState(null)

  const currentUser = JSON.parse(localStorage.getItem('epicast_user') || '{}')
  const isAdmin = currentUser.role === 'admin'

  const fetchUsers = async () => {
    setLoading(true)
    try { const { data } = await getUsers(); setUsers(data) } catch (_) {}
    setLoading(false)
  }

  useEffect(() => { fetchUsers() }, [])

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3500)
  }

  const openCreate = () => { setEditUser(null); setForm(BLANK); setShowForm(true) }
  const openEdit   = (u)  => {
    setEditUser(u)
    setForm({ username: u.username, password: '', role: u.role,
              assigned_area: u.assigned_area, assigned_clinic: u.assigned_clinic,
              full_name: u.full_name, email: u.email })
    setShowForm(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      if (editUser) {
        const payload = { role: form.role, assigned_area: form.assigned_area,
                          assigned_clinic: form.assigned_clinic, full_name: form.full_name,
                          email: form.email }
        if (form.password.trim()) payload.password = form.password
        await updateUser(editUser.id, payload)
        showToast(`User ${editUser.username} updated`)
      } else {
        await createUser(form)
        showToast(`User ${form.username} created`)
      }
      setShowForm(false); setForm(BLANK); setEditUser(null)
      fetchUsers()
    } catch (err) {
      showToast(err.response?.data?.detail || 'Operation failed', 'error')
    } finally { setSubmitting(false) }
  }

  const handleDelete = async (u) => {
    if (!window.confirm(`Delete user "${u.username}"?`)) return
    try { await deleteUser(u.id); showToast(`User ${u.username} deleted`); fetchUsers() }
    catch (err) { showToast(err.response?.data?.detail || 'Delete failed', 'error') }
  }

  const availableClinics = CLINICS_BY_AREA[form.assigned_area] || []

  if (!isAdmin) return (
    <div className="glass p-12 text-center fade-in">
      <Lock className="w-10 h-10 text-gray-300 mx-auto mb-3" />
      <p className="text-gray-400">Admin access required to manage users.</p>
    </div>
  )

  return (
    <div className="space-y-6 fade-in">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-5 py-3 rounded-xl shadow-lg border text-sm font-medium
          ${toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-700'
                                     : 'bg-red-50 border-red-200 text-red-700'}`}>
          {toast.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage system users and role assignments</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-black hover:bg-gray-900 rounded-xl text-white text-sm font-medium transition">
          <Plus className="w-4 h-4" />New User
        </button>
      </div>

      {/* Role legend */}
      <div className="flex flex-wrap gap-2">
        {ROLES.map(r => (
          <div key={r.value} className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium ${ROLE_COLOURS[r.value]}`}>
            <Shield className="w-3 h-3" />{r.label}
          </div>
        ))}
      </div>

      {/* Form */}
      {showForm && (
        <div className="glass p-6 fade-in">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-gray-900">{editUser ? `Edit: ${editUser.username}` : 'Create New User'}</h2>
            <button onClick={() => { setShowForm(false); setEditUser(null) }} className="text-gray-400 hover:text-gray-700">
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 font-medium mb-1.5">Username *</label>
              <input value={form.username} onChange={e => setForm({...form, username:e.target.value})}
                disabled={!!editUser} required placeholder="e.g. dr_smith"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-black transition" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 font-medium mb-1.5">{editUser ? 'New Password (leave blank to keep)' : 'Password *'}</label>
              <input type="password" value={form.password} onChange={e => setForm({...form, password:e.target.value})}
                required={!editUser} placeholder={editUser ? 'Leave blank to keep current' : 'Min 6 characters'}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black transition" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 font-medium mb-1.5">Full Name</label>
              <input value={form.full_name} onChange={e => setForm({...form, full_name:e.target.value})}
                placeholder="Dr. John Smith"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black transition" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 font-medium mb-1.5">Email</label>
              <input type="email" value={form.email} onChange={e => setForm({...form, email:e.target.value})}
                placeholder="user@hospital.in"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black transition" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 font-medium mb-1.5">Role *</label>
              <select value={form.role} onChange={e => setForm({...form, role:e.target.value, assigned_clinic:''})}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black transition">
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 font-medium mb-1.5">Assigned Area</label>
              <select value={form.assigned_area} onChange={e => setForm({...form, assigned_area:e.target.value, assigned_clinic:''})}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black transition">
                <option value="">— None —</option>
                {HYD_AREAS.map(a => <option key={a}>{a}</option>)}
              </select>
            </div>
            {['clinic_staff','hospital_staff'].includes(form.role) && (
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-500 font-medium mb-1.5">Assigned Clinic</label>
                <select value={form.assigned_clinic} onChange={e => setForm({...form, assigned_clinic:e.target.value})}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black transition">
                  <option value="">— None (all clinics in area) —</option>
                  {availableClinics.map(c => <option key={c}>{c}</option>)}
                </select>
                {!form.assigned_area && <p className="text-xs text-gray-400 mt-1">Select an area first to see clinics</p>}
              </div>
            )}
            <div className="md:col-span-2 flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => { setShowForm(false); setEditUser(null) }}
                className="px-5 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm hover:bg-gray-200 transition">Cancel</button>
              <button type="submit" disabled={submitting}
                className="px-6 py-2.5 rounded-xl bg-black hover:bg-gray-900 text-white text-sm font-medium transition disabled:opacity-50">
                {submitting ? 'Saving…' : editUser ? 'Save Changes' : 'Create User'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="glass p-5">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-4 h-4 text-gray-500" />
          <h2 className="font-semibold text-gray-900 text-sm">All Users</h2>
          <span className="text-xs text-gray-400 ml-1">({users.length})</span>
          <button onClick={fetchUsers} className="ml-auto p-2 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        {loading ? (
          <div className="flex justify-center py-12"><div className="w-7 h-7 border-2 border-gray-200 border-t-black rounded-full animate-spin"/></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  {['User','Role','Area / Clinic','Email','Actions'].map(h => (
                    <th key={h} className="text-left py-2.5 px-3 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-black flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {u.username[0]?.toUpperCase()}
                        </div>
                        <div>
                          <div className="text-gray-900 font-medium text-sm">{u.username}</div>
                          {u.full_name && <div className="text-xs text-gray-400">{u.full_name}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${ROLE_COLOURS[u.role] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                        {u.role_label}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-gray-500 text-xs">
                      {u.assigned_area && <div>{u.assigned_area}</div>}
                      {u.assigned_clinic && <div className="text-gray-400">{u.assigned_clinic}</div>}
                      {!u.assigned_area && !u.assigned_clinic && <span className="text-gray-300">—</span>}
                    </td>
                    <td className="py-2.5 px-3 text-gray-400 text-xs">{u.email || '—'}</td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(u)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-black hover:bg-gray-100 transition">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {u.username !== currentUser.username && (
                          <button onClick={() => handleDelete(u)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
