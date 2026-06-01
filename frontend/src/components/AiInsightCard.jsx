/**
 * AiInsightCard.jsx — Premium AI-generated outbreak recommendation card
 */

import React from 'react'
import { motion } from 'framer-motion'
import { Brain, ArrowRight, TrendingUp, AlertTriangle, Zap } from 'lucide-react'

const PRIORITY_CFG = {
  CRITICAL: { cls: 'border-rose-500/40 bg-rose-500/8',    badge: 'severity-CRITICAL', icon: AlertTriangle, color: '#f43f5e' },
  HIGH:     { cls: 'border-red-500/35 bg-red-500/7',       badge: 'severity-HIGH',     icon: Zap,           color: '#ef4444' },
  MODERATE: { cls: 'border-amber-500/30 bg-amber-500/6',   badge: 'severity-MODERATE', icon: TrendingUp,    color: '#f59e0b' },
  LOW:      { cls: 'border-emerald-500/25 bg-emerald-500/5',badge: 'severity-LOW',     icon: Brain,         color: '#10b981' },
}

const TYPE_LABEL = {
  VECTOR_CONTROL:    'Vector Control',
  WATER_SAFETY:      'Water Safety',
  CHOLERA_PREVENTION:'Cholera Prevention',
  CAPACITY_ALERT:    'Capacity Alert',
  RESPIRATORY_WATCH: 'Respiratory Watch',
  SURVEILLANCE:      'Surveillance',
  TREND_ALERT:       'Trend Analysis',
  WEATHER_CORRELATION:'Weather Correlation',
  RESOURCE_PLANNING: 'Resource Planning',
  GENOMIC_WATCH:     'Genomic Watch',
  HEATWAVE:          'Heatwave Alert',
}

export default function AiInsightCard({ insight, index = 0 }) {
  if (!insight) return null
  const cfg = PRIORITY_CFG[insight.priority] || PRIORITY_CFG.MODERATE
  const PriorityIcon = cfg.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={`relative overflow-hidden rounded-2xl border p-4 ${cfg.cls}`}
      style={{ boxShadow: `0 0 20px ${cfg.color}14` }}
    >
      {/* Subtle scan line for HIGH/CRITICAL */}
      {(insight.priority === 'HIGH' || insight.priority === 'CRITICAL') && (
        <div className="scan-line" style={{ zIndex: 0 }} />
      )}

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center text-base flex-shrink-0"
              style={{ background: `${cfg.color}20`, border: `1px solid ${cfg.color}40` }}
            >
              {insight.icon}
            </div>
            <div>
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
                AI Insight · {TYPE_LABEL[insight.type] || insight.type}
              </div>
              <div className="text-xs font-semibold text-gray-900 mt-0.5">
                {insight.area || 'Hyderabad'}
              </div>
            </div>
          </div>
          <span className={insight.priority ? `severity-${insight.priority}` : 'badge-yellow'}>
            {insight.priority}
          </span>
        </div>

        {/* Recommendation text */}
        <p className="text-sm text-gray-700 leading-relaxed mb-3">
          {insight.recommendation}
        </p>

        {/* Action */}
        {insight.action && (
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-gray-50 border border-gray-200 mb-3">
            <PriorityIcon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: cfg.color }} />
            <span className="text-xs text-gray-650">{insight.action}</span>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Brain className="w-3 h-3 text-purple-600" />
            <span className="text-[10px] text-gray-500">Confidence</span>
            <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: `linear-gradient(90deg, ${cfg.color}90, ${cfg.color})` }}
                initial={{ width: 0 }}
                animate={{ width: `${insight.confidence}%` }}
                transition={{ delay: index * 0.1 + 0.3, duration: 0.8, ease: 'easeOut' }}
              />
            </div>
            <span className="text-[10px] font-mono-data font-semibold" style={{ color: cfg.color }}>
              {insight.confidence}%
            </span>
          </div>
          <button className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 transition-colors group">
            Details
            <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>
    </motion.div>
  )
}
