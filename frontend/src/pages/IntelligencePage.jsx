/**
 * IntelligencePage.jsx — Disease Intelligence Feed, Live Events, AI Insights, News
 */

import React, { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getIntelFeed, getNewsHeadlines, getAiInsights } from '../api.js'
import AiInsightCard from '../components/AiInsightCard.jsx'
import { Zap, Newspaper, Brain, RefreshCw, AlertTriangle, Activity,
         Clock, MapPin, Building2, CheckCircle, Radio } from 'lucide-react'

const SEVERITY_CFG = {
  RED:   { cls: 'border-red-500/30 bg-red-500/8',   dot: 'bg-red-500',   label: 'CRITICAL' },
  AMBER: { cls: 'border-amber-500/30 bg-amber-500/7', dot: 'bg-amber-500', label: 'WARNING' },
  GREEN: { cls: 'border-emerald-500/25 bg-emerald-500/6', dot: 'bg-emerald-500', label: 'INFO' },
}

const TYPE_ICON = {
  HOSPITAL_REPORT:  Building2,
  LAB_CONFIRMATION: Activity,
  EMERGENCY_SPIKE:  AlertTriangle,
  ICU_ALERT:        AlertTriangle,
  FIELD_UPDATE:     MapPin,
  HEALTH_ADVISORY:  Radio,
  CASE_RECOVERY:    CheckCircle,
  LAB_PENDING:      Clock,
  VECTOR_ALERT:     AlertTriangle,
  SUPPLY_UPDATE:    CheckCircle,
}

function timeAgo(isoStr) {
  const diff = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`
  return `${Math.floor(diff/3600)}h ago`
}

function EventCard({ event, index }) {
  const cfg = SEVERITY_CFG[event.severity] || SEVERITY_CFG.GREEN
  const Icon = TYPE_ICON[event.type] || Activity
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04, duration: 0.4 }}
      className={`rounded-xl border p-3.5 ${cfg.cls}`}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot} ${event.severity === 'RED' ? 'animate-pulse' : ''}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
              {event.type?.replace(/_/g,' ')}
            </span>
            <span className="text-[10px] text-gray-400 flex-shrink-0 font-mono-data">
              {timeAgo(event.timestamp)}
            </span>
          </div>
          <p className="text-sm text-gray-700 leading-snug">{event.message}</p>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="text-[10px] text-gray-500 flex items-center gap-1"><MapPin className="w-2.5 h-2.5" />{event.area}</span>
            <span className="text-[10px] text-gray-400">·</span>
            <span className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded"
              style={{ background: event.severity === 'RED' ? 'rgba(239,68,68,0.1)' : event.severity === 'AMBER' ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.08)',
                       color: event.severity === 'RED' ? '#b91c1c' : event.severity === 'AMBER' ? '#b45309' : '#047857' }}>
              {cfg.label}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function NewsCard({ article, index }) {
  const sevColor = article.severity === 'HIGH' ? '#ef4444' : article.severity === 'MODERATE' ? '#f59e0b' : '#10b981'
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07 }}
      className="glass-bright p-4 rounded-xl"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded"
          style={{ background: `${sevColor}18`, color: sevColor, border: `1px solid ${sevColor}30` }}>
          {article.category}
        </span>
        <span className="text-[10px] text-gray-400 font-mono-data flex-shrink-0">{article.published}</span>
      </div>
      <h3 className="text-sm font-semibold text-gray-900 leading-snug mb-2">{article.title}</h3>
      <p className="text-xs text-gray-500 leading-relaxed mb-2">{article.summary}</p>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-gray-400">{article.source}</span>
        <span className={`text-[10px] font-semibold severity-${article.severity}`}>{article.severity}</span>
      </div>
    </motion.div>
  )
}

export default function IntelligencePage() {
  const [events,   setEvents]   = useState([])
  const [news,     setNews]     = useState([])
  const [insights, setInsights] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [activeTab, setActiveTab] = useState('feed')
  const [lastUpdate, setLastUpdate] = useState(new Date())

  const fetchAll = useCallback(async () => {
    try {
      const [f, n, i] = await Promise.all([getIntelFeed(24), getNewsHeadlines(), getAiInsights()])
      setEvents(f.data.events || [])
      setNews(n.data.articles || [])
      setInsights(i.data.insights || [])
      setLastUpdate(new Date())
    } catch (err) {
      console.error('Intel fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])
  useEffect(() => { const id = setInterval(fetchAll, 15_000); return () => clearInterval(id) }, [fetchAll])

  const critical = events.filter(e => e.severity === 'RED').length
  const warnings = events.filter(e => e.severity === 'AMBER').length

  const TABS = [
    { id: 'feed',     label: 'Live Feed',  icon: Radio,     count: events.length },
    { id: 'insights', label: 'AI Insights', icon: Brain,    count: insights.length },
    { id: 'news',     label: 'Health News', icon: Newspaper, count: news.length },
  ]

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="live-dot" />
            <span className="text-xs text-emerald-600 font-semibold">LIVE MONITORING</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Disease Intelligence Feed</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Real-time healthcare events · AI outbreak analysis · Regional health news
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-gray-400 font-mono-data">
            Updated {lastUpdate.toLocaleTimeString('en-IN', { hour12: false })}
          </div>
          <button onClick={fetchAll} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm transition">
            <RefreshCw className="w-4 h-4" />Refresh
          </button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Critical Events', value: critical, color: '#ef4444', bg: 'rgba(239,68,68,0.10)' },
          { label: 'Warnings',        value: warnings, color: '#f59e0b', bg: 'rgba(245,158,11,0.10)' },
          { label: 'Total Events',    value: events.length, color: '#3b82f6', bg: 'rgba(59,130,246,0.10)' },
        ].map(({ label, value, color, bg }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
            className="glass rounded-xl p-4 text-center"
            style={{ boxShadow: `0 0 16px ${color}14` }}
          >
            <div className="text-2xl font-bold font-mono-data" style={{ color }}>{loading ? '—' : value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{label}</div>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl border border-gray-200 w-fit">
        {TABS.map(({ id, label, icon: Icon, count }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === id
                ? 'bg-white text-gray-900 shadow-sm border border-gray-250'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-250 text-gray-600 font-mono-data">{count}</span>
          </button>
        ))}
      </div>

      {/* Tab panels */}
      <AnimatePresence mode="wait">
        {activeTab === 'feed' && (
          <motion.div key="feed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {loading ? (
              <div className="space-y-3">
                {[1,2,3,4,5].map(i => <div key={i} className="h-20 rounded-xl bg-gray-100 shimmer" />)}
              </div>
            ) : (
              <div className="space-y-2">
                {events.map((e, i) => <EventCard key={e.id} event={e} index={i} />)}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'insights' && (
          <motion.div key="insights" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {loading
                ? [1,2,3,4].map(i => <div key={i} className="h-48 rounded-2xl bg-gray-100 shimmer" />)
                : insights.map((ins, i) => <AiInsightCard key={i} insight={ins} index={i} />)
              }
            </div>
          </motion.div>
        )}

        {activeTab === 'news' && (
          <motion.div key="news" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {loading
                ? [1,2,3,4].map(i => <div key={i} className="h-36 rounded-xl bg-gray-100 shimmer" />)
                : news.map((a, i) => <NewsCard key={i} article={a} index={i} />)
              }
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
