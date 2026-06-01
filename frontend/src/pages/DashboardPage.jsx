/**
 * DashboardPage.jsx — Light theme matching login page design
 */

import React, { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  getDashboardStats, getDashboardZones, getDashboardAlerts,
  acknowledgeAlert, getObservations,
} from '../api.js'
import StatCard            from '../components/StatCard.jsx'
import OutbreakMap         from '../components/OutbreakMap.jsx'

import {
  Users, TrendingUp, Skull, MapPin, AlertTriangle, CheckCircle,
  RefreshCw, Bell, Map, Building2, Filter, Shield, BarChart2, Database, Activity,
} from 'lucide-react'

const AREAS    = ['Gachibowli','Jubilee Hills','Banjara Hills','Hitech City','Madhapur','Kukatpally','Secunderabad','Ameerpet','LB Nagar','Uppal','Kondapur','Miyapur','Begumpet','Tarnaka','Charminar']
const DISEASES = ['Dengue','Cholera','Malaria','COVID-19','Typhoid','Influenza']
const ZONES    = ['RED','YELLOW','GREEN']

const ROLE_BADGE = {
  admin:                 { label: 'Admin',                 cls: 'bg-red-50 text-red-700 border-red-200'           },
  hospital_staff:        { label: 'Hospital Staff',        cls: 'bg-blue-50 text-blue-700 border-blue-200'        },
  clinic_staff:          { label: 'Clinic Staff',          cls: 'bg-violet-50 text-violet-700 border-violet-200'  },
  public_health_officer: { label: 'Public Health Officer', cls: 'bg-green-50 text-green-700 border-green-200'     },
}

const OBS_STYLE = {
  HIGH:     { border: 'border-red-200 bg-red-50',    dot: 'bg-red-500',   label: 'text-red-700 bg-red-50 border-red-200'   },
  MODERATE: { border: 'border-amber-200 bg-amber-50', dot: 'bg-amber-500', label: 'text-amber-700 bg-amber-50 border-amber-200' },
  LOW:      { border: 'border-green-200 bg-green-50', dot: 'bg-green-500', label: 'text-green-700 bg-green-50 border-green-200' },
}

function ObservationCard({ obs, index }) {
  const s = OBS_STYLE[obs.priority] || OBS_STYLE.MODERATE
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.08 }}
      className={`rounded-xl border p-4 ${s.border}`}>
      <div className="flex items-start gap-3">
        <span className="text-xl flex-shrink-0 mt-0.5">{obs.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
              {obs.type?.replace(/_/g,' ')} · {obs.area}
            </span>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${s.label}`}>{obs.priority}</span>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed">{obs.recommendation}</p>
          {obs.action && <p className="text-xs text-gray-500 mt-1.5">→ {obs.action}</p>}
          {obs.metric && (
            <div className="mt-2 px-2 py-1 bg-white rounded-lg border border-gray-200 inline-block">
              <span className="text-[10px] font-mono text-gray-500">{obs.metric}</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

export default function DashboardPage() {
  const [stats, setStats] = useState(null)
  const [zones, setZones] = useState([])
  const [alerts, setAlerts] = useState([])
  const [observations, setObservations] = useState([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const [filterArea, setFilterArea] = useState('')
  const [filterDisease, setFilterDisease] = useState('')
  const [filterZone, setFilterZone] = useState('')

  const user      = JSON.parse(localStorage.getItem('epicast_user') || '{}')
  const roleBadge = ROLE_BADGE[user.role] || { label: user.role, cls: 'bg-gray-100 text-gray-600 border-gray-200' }

  const fetchAll = useCallback(async () => {
    setFetchError('')
    try {
      const params = {}
      if (filterArea)    params.area    = filterArea
      if (filterDisease) params.disease = filterDisease
      if (filterZone)    params.zone    = filterZone
      const [s, z, a, obs] = await Promise.all([
        getDashboardStats(), getDashboardZones(params),
        getDashboardAlerts(), getObservations(),
      ])
      setStats(s.data); setZones(z.data); setAlerts(a.data)
      setObservations(obs.data.insights || [])
      setLastRefresh(new Date())
    } catch (err) {
      console.error(err)
      setFetchError(err.response?.data?.detail || 'Unable to load dashboard data. Check your connection and try again.')
    } finally { setLoading(false) }
  }, [filterArea, filterDisease, filterZone])

  useEffect(() => { fetchAll() }, [fetchAll])
  useEffect(() => { const id = setInterval(fetchAll, 60_000); return () => clearInterval(id) }, [fetchAll])

  const handleAck = async (id) => {
    try {
      await acknowledgeAlert(id)
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'acknowledged' } : a))
    } catch (_) {}
  }

  const activeAlerts = alerts.filter(a => a.status === 'active')
  const selectCls = 'w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition'

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3 text-gray-400">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
        <span className="text-sm">Loading surveillance data…</span>
      </div>
    </div>
  )

  return (
    <div className="space-y-6 fade-in">
      {fetchError && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{fetchError}</span>
          <button type="button" onClick={fetchAll} className="ml-auto text-red-700 font-medium hover:underline">
            Retry
          </button>
        </div>
      )}
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hyderabad Outbreak Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Area-level disease surveillance · Population-normalised risk scoring</p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium ${roleBadge.cls}`}>
            <Shield className="w-3.5 h-3.5" />{roleBadge.label}
            {user.assigned_clinic && <span className="text-gray-400 ml-1">· {user.assigned_clinic}</span>}
          </div>
          <button onClick={fetchAll}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-black text-white text-sm font-medium hover:bg-gray-900 transition">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>
      <p className="text-xs text-gray-400 -mt-4 font-mono-data">
        Last updated: {lastRefresh.toLocaleTimeString('en-IN', { hour12: false })} IST · Epicast Database
      </p>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard title="Active Cases"   value={stats.active_cases?.toLocaleString()} icon={Users}         color="default" />
          <StatCard title="Total Cases"    value={stats.total_cases?.toLocaleString()}  icon={TrendingUp}    color="default" />
          <StatCard title="Total Deaths"   value={stats.total_deaths?.toLocaleString()} icon={Skull}         color="default" />
          <StatCard title="Red Zones"      value={stats.red_zones}                      icon={AlertTriangle} color="red"     />
          <StatCard title="Yellow Zones"   value={stats.yellow_zones}                   icon={MapPin}        color="amber"   />
          <StatCard title="Active Clinics" value={stats.total_clinics}                  icon={Building2}     color="green"   />
        </div>
      )}

      {/* Filters */}
      <div className="glass p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-semibold text-gray-900">Filters</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { value: filterArea,    setter: setFilterArea,    opts: AREAS,    placeholder: 'All Areas'    },
            { value: filterDisease, setter: setFilterDisease, opts: DISEASES, placeholder: 'All Diseases' },
            { value: filterZone,    setter: setFilterZone,    opts: ZONES,    placeholder: 'All Zones'    },
          ].map(({ value, setter, opts, placeholder }) => (
            <select key={placeholder} value={value} onChange={e => setter(e.target.value)} className={selectCls}>
              <option value="">{placeholder}</option>
              {opts.map(o => <option key={o}>{o}</option>)}
            </select>
          ))}
        </div>
        {(filterArea || filterDisease || filterZone) && (
          <button onClick={() => { setFilterArea(''); setFilterDisease(''); setFilterZone('') }}
            className="mt-2 text-xs text-gray-500 hover:text-black transition">✕ Clear filters</button>
        )}
      </div>

      {/* Map + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass p-5">
          <div className="flex items-center gap-2 mb-4">
            <Map className="w-4 h-4 text-gray-500" />
            <h2 className="font-semibold text-gray-900 text-sm">Area Risk Map</h2>
            <span className="ml-auto text-xs text-gray-400">{zones.length} areas · risk score 0–100</span>
          </div>
          <OutbreakMap zones={zones} />
          <div className="flex items-center gap-5 mt-3">
            {[['RED','bg-red-500','Critical (≥70)'],['YELLOW','bg-amber-400','Elevated (40–69)'],['GREEN','bg-green-500','Normal (<40)']].map(([z,cls,lbl]) => (
              <div key={z} className="flex items-center gap-1.5 text-xs text-gray-500">
                <div className={`w-3 h-3 rounded-full ${cls}`} />{lbl}
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5">
            Circle size = area population · opacity = risk intensity · pulse = RED zones only
          </p>
        </div>

        {/* Alerts */}
        <div className="glass p-5 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-4 h-4 text-amber-500" />
            <h2 className="font-semibold text-gray-900 text-sm">Active Alerts</h2>
            {activeAlerts.length > 0 && (
              <span className="ml-auto bg-red-50 text-red-700 text-xs px-2 py-0.5 rounded-full border border-red-200">
                {activeAlerts.length}
              </span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {activeAlerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-gray-400 text-sm">
                <CheckCircle className="w-8 h-8 mb-2 text-green-400" />No active alerts
              </div>
            ) : activeAlerts.slice(0, 12).map(a => (
              <motion.div key={a.id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
                className={`rounded-xl p-3 border text-sm
                  ${a.risk_level === 'RED' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                <p className="font-semibold text-gray-900 text-xs mb-0.5">{a.disease_name} — {a.area_name}</p>
                <p className="text-gray-500 text-xs mb-1">{a.clinics_involved} clinic{a.clinics_involved !== 1 ? 's' : ''}</p>
                <p className="text-gray-600 text-xs leading-snug">{a.message}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-gray-400">{new Date(a.timestamp).toLocaleDateString('en-IN')}</span>
                  <button onClick={() => handleAck(a.id)}
                    className="text-xs text-black font-semibold hover:underline transition">Acknowledge</button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Surveillance Observations */}
      {observations.length > 0 && (
        <div className="glass p-5">
          <div className="flex items-center gap-2 mb-1">
            <BarChart2 className="w-4 h-4 text-gray-500" />
            <h2 className="font-semibold text-gray-900 text-sm">Surveillance Observations</h2>
            <span className="ml-auto flex items-center gap-1.5 text-[10px] text-gray-400">
              <Database className="w-3 h-3" />Calculated from database · no AI predictions
            </span>
          </div>
          <p className="text-xs text-gray-400 mb-4">All observations derived from verified clinic reports. Metrics are deterministic calculations.</p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {observations.map((obs, i) => <ObservationCard key={i} obs={obs} index={i} />)}
          </div>
        </div>
      )}



      {/* Area grid */}
      <div className="glass p-5">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-gray-500" />
          <h2 className="font-semibold text-gray-900 text-sm">Area-wise Risk Status</h2>
          <span className="ml-auto text-xs text-gray-400">Sorted by risk score</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[...zones].sort((a, b) => (b.risk_score||0)-(a.risk_score||0)).map((z, i) => {
            const col = z.zone==='RED' ? 'border-red-200 bg-red-50' : z.zone==='YELLOW' ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50'
            const score = z.zone==='RED' ? 'text-red-700' : z.zone==='YELLOW' ? 'text-amber-700' : 'text-green-700'
            const badge = z.zone==='RED' ? 'bg-red-100 text-red-700 border-red-200' : z.zone==='YELLOW' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-green-100 text-green-700 border-green-200'
            return (
              <motion.div key={z.area_id}
                initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.025 }}
                className={`rounded-xl border p-3 ${col} hover:shadow-sm transition-shadow cursor-default`}>
                <p className="text-xs font-semibold text-gray-900 mb-1">{z.area_name}</p>
                <p className="text-xs text-gray-500 mb-0.5">{z.clinic_count} clinic{z.clinic_count!==1?'s':''} · {z.disease_count} disease{z.disease_count!==1?'s':''}</p>
                <p className="text-xs text-gray-600 font-mono-data mb-1">{z.total_cases?.toLocaleString()} cases</p>
                {z.cases_per_100k != null && <p className="text-[10px] text-gray-500 font-mono-data mb-1">{z.cases_per_100k.toFixed(1)}/100k</p>}
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold ${score}`}>{z.risk_score != null ? `${z.risk_score}/100` : z.zone}</span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${badge}`}>{z.zone}</span>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
