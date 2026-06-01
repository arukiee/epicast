/**
 * AlertsPage.jsx — Alerts derived exclusively from aggregated clinic reports.
 *
 * Data flow: Reports → refresh_area_alerts() → /dashboard/alerts → here.
 * Every field shown (case count, incidence, trend, clinics) is calculated
 * deterministically from verified report data. No independent alert generation.
 */

import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getDashboardAlerts, acknowledgeAlert, syncAlerts } from '../api.js'
import {
  Bell, CheckCircle, RefreshCw, AlertTriangle, Zap, Building2,
  MapPin, Clock, Filter, RotateCcw, Database, TrendingUp, TrendingDown, Minus,
} from 'lucide-react'

const user = JSON.parse(localStorage.getItem('epicast_user') || '{}')

function TrendIcon({ trend }) {
  if (!trend) return null
  const t = trend.toLowerCase()
  if (t.includes('increas') || t.includes('new'))
    return <TrendingUp className="w-3.5 h-3.5 text-red-500" />
  if (t.includes('decreas'))
    return <TrendingDown className="w-3.5 h-3.5 text-green-600" />
  return <Minus className="w-3.5 h-3.5 text-gray-400" />
}

export default function AlertsPage() {
  const [alerts,   setAlerts]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [syncing,  setSyncing]  = useState(false)
  const [filter,   setFilter]   = useState('all')
  const [syncMsg,  setSyncMsg]  = useState('')

  const fetchAlerts = async () => {
    setLoading(true)
    try { const { data } = await getDashboardAlerts(); setAlerts(data) }
    catch (_) {} finally { setLoading(false) }
  }

  useEffect(() => { fetchAlerts() }, [])

  const handleAck = async (id) => {
    try {
      await acknowledgeAlert(id)
      setAlerts(p => p.map(a => a.id === id ? { ...a, status: 'acknowledged' } : a))
    } catch (_) {}
  }

  const handleSync = async () => {
    setSyncing(true); setSyncMsg('')
    try {
      const { data } = await syncAlerts()
      setSyncMsg(`Sync complete — ${data.active_alerts} active alert(s) derived from reports`)
      await fetchAlerts()
    } catch (err) {
      setSyncMsg(err.response?.data?.detail || 'Sync failed')
    } finally { setSyncing(false) }
  }

  const displayed   = alerts.filter(a => filter === 'all' ? true : a.status === filter)
  const activeCount = alerts.filter(a => a.status === 'active').length
  const ackedCount  = alerts.filter(a => a.status === 'acknowledged').length
  const redCount    = alerts.filter(a => a.status === 'active' && a.risk_level === 'RED').length
  const isAdmin     = user.role === 'admin'

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hyderabad Outbreak Alerts</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Cluster-based alerts derived from aggregated clinic reports
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button onClick={handleSync} disabled={syncing}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200
                         text-gray-700 text-sm font-medium transition disabled:opacity-50">
              <RotateCcw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing…' : 'Sync from Reports'}
            </button>
          )}
          <button onClick={fetchAlerts}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-black text-white text-sm font-medium hover:bg-gray-900 transition">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Data lineage notice */}
      <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 text-gray-500 rounded-xl px-4 py-2.5 text-xs">
        <Database className="w-3.5 h-3.5 flex-shrink-0" />
        All alerts are automatically computed from submitted clinic reports using population-normalised
        incidence thresholds (≥50/100k = RED · ≥15/100k or ≥2 clinics = YELLOW). No independent data.
      </div>

      {syncMsg && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-2.5 text-xs">
          <CheckCircle className="w-3.5 h-3.5" /> {syncMsg}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Alerts',   value: alerts.length, cls: 'bg-white border-gray-200',       icon: Bell         },
          { label: 'RED Critical',   value: redCount,      cls: 'bg-red-50 border-red-200',        icon: Zap          },
          { label: 'Active',         value: activeCount,   cls: 'bg-amber-50 border-amber-200',    icon: AlertTriangle},
          { label: 'Acknowledged',   value: ackedCount,    cls: 'bg-green-50 border-green-200',    icon: CheckCircle  },
        ].map(({ label, value, cls, icon: Icon }, i) => (
          <motion.div key={label}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
            className={`rounded-2xl border p-5 flex items-center gap-4 ${cls}`}>
            <Icon className="w-5 h-5 text-gray-400 flex-shrink-0" />
            <div>
              <div className="text-2xl font-bold text-gray-900">{value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{label}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-gray-400" />
        {[
          { key: 'all',          label: 'All' },
          { key: 'active',       label: `Active (${activeCount})` },
          { key: 'acknowledged', label: `Acknowledged (${ackedCount})` },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-4 py-1.5 rounded-xl text-xs font-medium transition
              ${filter === f.key ? 'bg-black text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Alert list */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <div className="w-8 h-8 border-2 border-gray-200 border-t-black rounded-full animate-spin mb-3" />
          <span className="text-sm">Loading alerts…</span>
        </div>
      ) : displayed.length === 0 ? (
        <div className="glass p-14 text-center">
          <Bell className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No alerts match the current filter</p>
          <p className="text-xs text-gray-400 mt-1">
            Alerts are generated when incidence ≥15/100k or ≥2 clinics report the same disease
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {displayed.map((a, i) => {
              const isRed = a.risk_level === 'RED'
              const isAck = a.status === 'acknowledged'

              // Parse stats out of message (deterministic format)
              const trendMatch  = a.message.match(/Trend:\s*([^.]+)/)
              const trend       = trendMatch?.[1]?.trim() || ''
              const scoreMatch  = a.message.match(/Risk score:\s*([\d.]+)/)
              const scoreVal    = scoreMatch?.[1] ? parseFloat(scoreMatch[1]).toFixed(0) : null
              const inciMatch   = a.message.match(/Incidence:\s*([\d]+)\/100k/)
              const inciVal     = inciMatch?.[1] || null
              const casesMatch  = a.message.match(/([\d,]+)\s+combined case/)
              const casesVal    = casesMatch?.[1] || null

              return (
                <motion.div key={a.id}
                  initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className={`glass p-5 border transition-shadow hover:shadow-sm
                    ${isAck
                      ? 'opacity-60 border-gray-200 bg-gray-50'
                      : isRed
                        ? 'border-red-200 bg-red-50'
                        : 'border-amber-200 bg-amber-50'}`}>
                  <div className="flex items-start gap-4">
                    <div className={`p-2.5 rounded-xl flex-shrink-0
                      ${isAck ? 'bg-gray-100' : isRed ? 'bg-red-100' : 'bg-amber-100'}`}>
                      {isAck
                        ? <CheckCircle className="w-5 h-5 text-green-600" />
                        : isRed
                          ? <Zap className="w-5 h-5 text-red-600" />
                          : <AlertTriangle className="w-5 h-5 text-amber-600" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Title row */}
                      <div className="flex items-center gap-3 flex-wrap mb-2">
                        <span className="font-semibold text-gray-900 text-sm">{a.disease_name}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase tracking-wide
                          ${isAck
                            ? 'bg-gray-100 text-gray-500 border-gray-200'
                            : isRed
                              ? 'bg-red-100 text-red-700 border-red-200'
                              : 'bg-amber-100 text-amber-700 border-amber-200'}`}>
                          {isAck ? '✓ Acknowledged' : isRed ? '🚨 Critical' : '⚠️ Elevated'}
                        </span>
                      </div>

                      {/* Location */}
                      <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />{a.area_name}
                        </span>
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          {a.clinics_involved} clinic{a.clinics_involved !== 1 ? 's' : ''} reporting
                        </span>
                      </div>

                      {/* Derived stats row */}
                      <div className="flex flex-wrap gap-2 mb-3">
                        {casesVal && (
                          <div className="flex items-center gap-1 text-xs px-2.5 py-1 bg-white rounded-lg border border-gray-200 text-gray-700">
                            <span className="font-semibold text-gray-900">{casesVal}</span>&nbsp;combined cases
                          </div>
                        )}
                        {inciVal && (
                          <div className="flex items-center gap-1 text-xs px-2.5 py-1 bg-white rounded-lg border border-gray-200 text-gray-700">
                            <span className="font-semibold text-gray-900">{inciVal}</span>/100k incidence
                          </div>
                        )}
                        {scoreVal && (
                          <div className="flex items-center gap-1 text-xs px-2.5 py-1 bg-white rounded-lg border border-gray-200 text-gray-700">
                            Risk score:&nbsp;<span className="font-semibold text-gray-900">{scoreVal}/100</span>
                          </div>
                        )}
                        {trend && (
                          <div className="flex items-center gap-1 text-xs px-2.5 py-1 bg-white rounded-lg border border-gray-200 text-gray-700">
                            <TrendIcon trend={trend} />
                            <span className="font-medium">{trend}</span>
                          </div>
                        )}
                      </div>

                      {/* Affected clinics */}
                      {a.affected_clinics?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {a.affected_clinics.slice(0, 5).map(c => (
                            <span key={c}
                              className="text-xs px-2 py-0.5 rounded-full bg-white text-gray-600 border border-gray-200">
                              {c}
                            </span>
                          ))}
                          {a.affected_clinics.length > 5 && (
                            <span className="text-xs text-gray-400">+{a.affected_clinics.length - 5} more</span>
                          )}
                        </div>
                      )}

                      {/* Footer */}
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <Clock className="w-3 h-3" />
                          {new Date(a.timestamp).toLocaleString('en-IN')}
                          <span className="ml-2 text-gray-300">· Last synced from reports</span>
                        </span>
                        {!isAck && (
                          <button onClick={() => handleAck(a.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-black hover:bg-gray-900
                                       text-white rounded-xl text-xs font-medium transition">
                            <CheckCircle className="w-3.5 h-3.5" /> Acknowledge
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
