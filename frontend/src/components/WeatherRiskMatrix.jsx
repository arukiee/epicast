/**
 * WeatherRiskMatrix.jsx — Environmental disease risk scoring grid
 */

import React from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

function RiskCell({ score, color, delay = 0 }) {
  const opacity = Math.max(0.08, score / 100)
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.4, ease: 'easeOut' }}
      className="relative rounded-lg p-2 flex flex-col items-center justify-center"
      style={{ background: `${color}${Math.round(opacity * 255).toString(16).padStart(2,'0')}`, border: `1px solid ${color}30` }}
    >
      <div className="text-sm font-bold font-mono-data" style={{ color }}>{score}</div>
      <div className="text-[9px] text-slate-500">/ 100</div>
    </motion.div>
  )
}

function TrendIcon({ trend }) {
  if (trend === 'rising')  return <TrendingUp  className="w-3 h-3 text-red-400 inline ml-1" />
  if (trend === 'falling') return <TrendingDown className="w-3 h-3 text-emerald-400 inline ml-1" />
  return <Minus className="w-3 h-3 text-slate-500 inline ml-1" />
}

export default function WeatherRiskMatrix({ risks = [] }) {
  if (!risks || risks.length === 0) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {[1,2,3,4,5,6].map(i => (
          <div key={i} className="h-20 rounded-xl bg-slate-800/50 shimmer" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {risks.map((risk, i) => (
        <motion.div
          key={risk.disease}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-xl border p-3 space-y-2"
          style={{
            background: `${risk.color}0D`,
            border: `1px solid ${risk.color}30`,
            boxShadow: risk.level === 'HIGH' ? `0 0 16px ${risk.color}18` : 'none',
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200">{risk.disease}</span>
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide"
              style={{ background: `${risk.color}25`, color: risk.color }}
            >
              {risk.level}
            </span>
          </div>

          {/* Score bar */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] text-slate-500">Risk Score</span>
              <span className="text-sm font-bold font-mono-data" style={{ color: risk.color }}>
                {risk.score}
                <TrendIcon trend={risk.trend} />
              </span>
            </div>
            <div className="h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: `linear-gradient(90deg, ${risk.color}70, ${risk.color})` }}
                initial={{ width: 0 }}
                animate={{ width: `${risk.score}%` }}
                transition={{ delay: i * 0.08 + 0.2, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
          </div>

          <p className="text-[10px] text-slate-500 leading-snug">{risk.driver}</p>
        </motion.div>
      ))}
    </div>
  )
}
