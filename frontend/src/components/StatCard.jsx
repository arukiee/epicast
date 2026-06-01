/**
 * StatCard.jsx — KPI card, light theme matching login page
 */

import React from 'react'
import { motion } from 'framer-motion'

export default function StatCard({ title, value, icon: Icon, color = 'default', trend }) {
  const colours = {
    default: { bg: 'bg-gray-100',    icon: 'text-gray-500',   border: '' },
    red:     { bg: 'bg-red-50',      icon: 'text-red-600',    border: '' },
    amber:   { bg: 'bg-amber-50',    icon: 'text-amber-600',  border: '' },
    green:   { bg: 'bg-green-50',    icon: 'text-green-600',  border: '' },
    blue:    { bg: 'bg-blue-50',     icon: 'text-blue-600',   border: '' },
    violet:  { bg: 'bg-violet-50',   icon: 'text-violet-600', border: '' },
  }
  const c = colours[color] || colours.default

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="glass p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</p>
        <div className={`p-2 rounded-xl ${c.bg}`}>
          <Icon className={`w-4 h-4 ${c.icon}`} />
        </div>
      </div>
      <p className="text-3xl font-bold text-gray-900">{value ?? '—'}</p>
      {trend && <p className="text-xs text-gray-400 mt-1">{trend}</p>}
    </motion.div>
  )
}
