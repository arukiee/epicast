/**
 * ResourceStressPanel.jsx — Hospital occupancy, ICU stress, medicine demand
 */

import React from 'react'
import { motion } from 'framer-motion'
import { Hospital, Activity, Package, AlertTriangle, CheckCircle } from 'lucide-react'

function StressBar({ label, value, stress, delay = 0 }) {
  const color = stress === 'CRITICAL' ? '#ef4444' : stress === 'HIGH' ? '#f59e0b' : stress === 'MODERATE' ? '#3b82f6' : '#10b981'
  const bg    = stress === 'CRITICAL' ? 'rgba(239,68,68,0.12)' : stress === 'HIGH' ? 'rgba(245,158,11,0.10)' : 'rgba(16,185,129,0.08)'

  return (
    <div className="space-y-1.5" style={{ '--target-width': `${value}%` }}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400 truncate pr-2">{label}</span>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs font-mono-data font-semibold" style={{ color }}>{value}%</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide" style={{ background: bg, color }}>{stress}</span>
        </div>
      </div>
      <div className="h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${color}80, ${color})` }}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ delay, duration: 1.0, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </div>
  )
}

export default function ResourceStressPanel({ data, loading }) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1,2,3].map(i => (
          <div key={i} className="h-10 rounded-xl bg-slate-800/50 shimmer" />
        ))}
      </div>
    )
  }

  if (!data) return null

  const overallColor = data.overall_stress === 'CRITICAL' ? 'text-red-400' : data.overall_stress === 'HIGH' ? 'text-amber-400' : 'text-blue-400'

  return (
    <div className="space-y-5">
      {/* City overview */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Avg Occupancy', value: `${data.city_avg_occupancy}%`, color: overallColor },
          { label: 'ICU Utilisation', value: `${data.city_avg_icu}%`, color: data.city_avg_icu > 80 ? 'text-red-400' : 'text-amber-400' },
          { label: 'Stress Level', value: data.overall_stress, color: overallColor },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-slate-800/50 rounded-xl p-3 text-center border border-slate-700/40">
            <div className="text-[10px] text-slate-500 mb-1">{label}</div>
            <div className={`text-sm font-bold font-mono-data ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Hospital bars */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Hospital className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-xs font-semibold text-slate-300">Hospital Occupancy</span>
        </div>
        <div className="space-y-3">
          {data.hospitals?.map((h, i) => (
            <StressBar
              key={h.name}
              label={h.name}
              value={h.occupancy}
              stress={h.stress_level}
              delay={i * 0.08}
            />
          ))}
        </div>
      </div>

      {/* Medicine demand */}
      {data.medicine_demand && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Package className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-xs font-semibold text-slate-300">Medicine Demand Index</span>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {data.medicine_demand.map((m, i) => {
              const trend = m.trend === 'critical' ? 'text-red-400' : m.trend === 'rising' ? 'text-amber-400' : 'text-slate-400'
              const stress = m.demand > 80 ? 'CRITICAL' : m.demand > 65 ? 'HIGH' : 'MODERATE'
              return (
                <StressBar
                  key={m.medicine}
                  label={m.medicine}
                  value={m.demand}
                  stress={stress}
                  delay={i * 0.06 + 0.3}
                />
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
