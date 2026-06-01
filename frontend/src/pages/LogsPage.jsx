/**
 * LogsPage.jsx — Light theme matching login page
 */
import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { getLogs } from '../api.js'
import { ScrollText, RefreshCw, Lock, Search, ChevronDown } from 'lucide-react'

const ACTION_STYLE = {
  LOGIN:     'bg-green-50  text-green-700  border-green-200',
  LOGOUT:    'bg-gray-100  text-gray-600   border-gray-200',
  REPORT:    'bg-blue-50   text-blue-700   border-blue-200',
  ALERT:     'bg-amber-50  text-amber-700  border-amber-200',
  FORECAST:  'bg-purple-50 text-purple-700 border-purple-200',
  DASHBOARD: 'bg-sky-50    text-sky-700    border-sky-200',
  DEFAULT:   'bg-gray-100  text-gray-600   border-gray-200',
}
function getActionStyle(action = '') {
  const a = action.toUpperCase()
  for (const key of Object.keys(ACTION_STYLE)) {
    if (key !== 'DEFAULT' && a.includes(key)) return ACTION_STYLE[key]
  }
  return ACTION_STYLE.DEFAULT
}

export default function LogsPage() {
  const [logs, setLogs]       = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [search, setSearch]   = useState('')
  const [visible, setVisible] = useState(50)

  const fetchLogs = async () => {
    setLoading(true); setError('')
    try { const { data } = await getLogs(); setLogs(data) }
    catch (err) {
      const s = err.response?.status, d = err.response?.data?.detail
      if (s === 403) setError('Access denied — administrators only.')
      else if (s === 401) setError(typeof d === 'string' ? d : 'Session invalid. Please sign in again.')
      else setError('Failed to load activity logs.')
    } finally { setLoading(false) }
  }
  useEffect(() => { fetchLogs() }, [])

  const filtered = logs.filter(l =>
    !search || l.username?.toLowerCase().includes(search.toLowerCase()) || l.action?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6 fade-in">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Activity Logs</h1>
          <p className="text-sm text-gray-500 mt-0.5">Admin audit trail — all platform actions</p>
        </div>
        <button onClick={fetchLogs}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-black text-white text-sm font-medium hover:bg-gray-900 transition">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 text-gray-600 rounded-xl px-4 py-2.5 text-xs">
        <Lock className="w-3.5 h-3.5" /> Restricted to administrators.
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          <Lock className="w-4 h-4" /> {error}
        </div>
      )}

      {!error && (
        <>
          <div className="glass p-4">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search by username or action…"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black transition" />
            </div>
          </div>

          <div className="glass p-5">
            <div className="flex items-center gap-2 mb-4">
              <ScrollText className="w-4 h-4 text-gray-500" />
              <h2 className="font-semibold text-gray-900 text-sm">Audit Trail</h2>
              <span className="text-xs text-gray-400 ml-1">({filtered.length} entries)</span>
            </div>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-8 h-8 border-2 border-gray-200 border-t-black rounded-full animate-spin mb-3" />
                <span className="text-sm text-gray-400">Loading…</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      {['#','User','Action','Details','Timestamp'].map(h => (
                        <th key={h} className="text-left py-2.5 px-3 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.slice(0, visible).map((l, i) => (
                      <motion.tr key={l.id}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        transition={{ delay: Math.min(i * 0.01, 0.2) }}
                        className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="py-2.5 px-3 text-gray-400 text-xs font-mono-data">{l.id}</td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-black flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                              {l.username?.[0]?.toUpperCase()}
                            </div>
                            <span className="text-gray-900 font-medium text-sm">{l.username}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${getActionStyle(l.action)}`}>{l.action}</span>
                        </td>
                        <td className="py-2.5 px-3 text-gray-400 text-xs max-w-[180px] truncate">{l.meta || '—'}</td>
                        <td className="py-2.5 px-3 text-gray-400 text-xs font-mono-data whitespace-nowrap">{new Date(l.timestamp).toLocaleString('en-IN')}</td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
                {filtered.length === 0 && <p className="text-center text-gray-400 py-10 text-sm">No log entries found</p>}
                {filtered.length > visible && (
                  <div className="text-center pt-4">
                    <button onClick={() => setVisible(v => v + 50)}
                      className="flex items-center gap-2 mx-auto px-5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm transition">
                      <ChevronDown className="w-4 h-4" /> Show more ({filtered.length - visible} remaining)
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
