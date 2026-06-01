/**
 * WeatherPage.jsx — Environmental risk intelligence: weather + disease risk matrix
 */

import React, { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { getWeather, getWeatherRisk } from '../api.js'
import WeatherRiskMatrix from '../components/WeatherRiskMatrix.jsx'
import { Cloud, Droplets, Wind, Thermometer, Sun, AlertTriangle,
         RefreshCw, Activity, TrendingUp } from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'

const WMO_EMOJI = {
  0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
  45: '🌫️', 51: '🌦️', 53: '🌧️', 55: '🌧️',
  61: '🌧️', 63: '🌧️', 65: '⛈️',
  80: '🌦️', 81: '🌧️', 82: '⛈️', 95: '⛈️',
}

function WeatherStat({ icon: Icon, label, value, unit, color = '#94a3b8' }) {
  return (
    <div className="glass rounded-xl p-4 text-center">
      <Icon className="w-5 h-5 mx-auto mb-2" style={{ color }} />
      <div className="text-xl font-bold font-mono-data" style={{ color }}>{value}<span className="text-sm font-normal text-slate-500 ml-0.5">{unit}</span></div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs">
      <div className="text-slate-400 mb-1">{label}</div>
      {payload.map(p => (
        <div key={p.name} className="font-semibold" style={{ color: p.color }}>
          {p.name}: {p.value}{p.unit || ''}
        </div>
      ))}
    </div>
  )
}

export default function WeatherPage() {
  const [weather, setWeather] = useState(null)
  const [risk,    setRisk]    = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    try {
      const [w, r] = await Promise.all([getWeather(), getWeatherRisk()])
      setWeather(w.data)
      setRisk(r.data)
    } catch (err) {
      console.error('Weather fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const current = weather?.current
  const daily   = weather?.daily || []

  // Chart data from 7-day forecast
  const rainChartData = daily.map(d => ({
    date: d.date, rain: d.rain_sum, prob: d.rain_prob, uv: d.uv_max,
  }))

  const advisoryColor = risk?.overall_level === 'HIGH'
    ? '#ef4444' : risk?.overall_level === 'MODERATE'
    ? '#f59e0b' : '#10b981'

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Environmental Risk Intelligence</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Hyderabad weather · Disease risk correlation · 7-day environmental forecast
          </p>
        </div>
        <div className="flex items-center gap-3">
          {weather?.source && (
            <span className="text-xs text-gray-500 px-2 py-1 bg-gray-100 rounded-lg border border-gray-200">
              Source: {weather.source === 'open-meteo' ? 'Open-Meteo API ✓' : 'Simulated Data'}
            </span>
          )}
          <button onClick={fetchAll} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm transition">
            <RefreshCw className="w-4 h-4" />Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-24 rounded-xl bg-gray-100 shimmer" />)}
        </div>
      ) : current && (
        <>
          {/* Current weather hero */}
          <div className="glass p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="text-4xl mb-1">{WMO_EMOJI[current.condition_code] || '🌤️'}</div>
                <h2 className="text-lg font-semibold text-gray-900">{current.condition}</h2>
                <p className="text-xs text-gray-400">Hyderabad, Telangana · IST</p>
              </div>
              <div className="text-right">
                <div className="text-5xl font-bold font-mono-data text-gray-900">{current.temperature?.toFixed(1)}<span className="text-2xl text-gray-400">°C</span></div>
                <div className="text-sm text-gray-400">Feels like {current.feels_like?.toFixed(1)}°C</div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <WeatherStat icon={Droplets}    label="Humidity"    value={current.humidity}            unit="%" color="#38bdf8" />
              <WeatherStat icon={Cloud}       label="Rain Today"  value={current.rain?.toFixed(1)}    unit="mm" color="#818cf8" />
              <WeatherStat icon={Wind}        label="Wind Speed"  value={current.wind_speed?.toFixed(1)} unit="km/h" color="#34d399" />
              <WeatherStat icon={Sun}         label="UV Index"    value={current.uv_index?.toFixed(1)}  unit="" color="#fb923c" />
            </div>
          </div>

          {/* Overall advisory */}
          {risk?.overall_advisory && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border p-4 flex items-center gap-4"
              style={{ background: `${advisoryColor}10`, border: `1px solid ${advisoryColor}35`, boxShadow: `0 0 20px ${advisoryColor}14` }}
            >
              <AlertTriangle className="w-6 h-6 flex-shrink-0" style={{ color: advisoryColor }} />
              <div>
                <div className="text-xs font-bold uppercase tracking-widest mb-0.5" style={{ color: advisoryColor }}>
                  Environmental Advisory — {risk.overall_level}
                </div>
                <div className="text-sm text-gray-700">{risk.overall_advisory}</div>
              </div>
            </motion.div>
          )}

          {/* 2-col: disease risk + chart */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Disease risk matrix */}
            <div className="glass p-5">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-4 h-4 text-brand-500" />
                <h2 className="font-semibold text-gray-900 text-sm">Environmental Disease Risk Matrix</h2>
              </div>
              <WeatherRiskMatrix risks={risk?.risks || []} />
            </div>

            {/* 7-day rainfall forecast */}
            <div className="glass p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-blue-500" />
                <h2 className="font-semibold text-gray-900 text-sm">7-Day Rainfall Forecast</h2>
                <span className="ml-auto text-xs text-gray-400">mm precipitation</span>
              </div>
              {rainChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={rainChartData}>
                    <defs>
                      <linearGradient id="rainGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" />
                    <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="rain" name="Rainfall" stroke="#818cf8" fill="url(#rainGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No forecast data</div>
              )}
            </div>
          </div>

          {/* 7-day summary table */}
          <div className="glass p-5">
            <div className="flex items-center gap-2 mb-4">
              <Cloud className="w-4 h-4 text-gray-400" />
              <h2 className="font-semibold text-gray-900 text-sm">7-Day Weather Summary</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              {daily.map((d, i) => (
                <motion.div
                  key={d.date}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className={`rounded-xl p-3 text-center border ${
                    d.rain_prob > 70 ? 'border-indigo-200 bg-indigo-50/40' :
                    d.rain_prob > 40 ? 'border-blue-100 bg-blue-50/30' :
                    'border-gray-200 bg-gray-50/50 hover:bg-gray-50/80'
                  }`}
                >
                  <div className="text-xs font-semibold text-gray-700 mb-1">{d.date}</div>
                  <div className="text-lg mb-1">{d.rain_prob > 60 ? '🌧️' : d.rain_prob > 30 ? '⛅' : '☀️'}</div>
                  <div className="text-xs font-bold text-gray-900 font-mono-data">{d.temp_max}°</div>
                  <div className="text-[10px] text-gray-400">{d.temp_min}° min</div>
                  <div className="text-[10px] text-blue-600 mt-1">{d.rain_prob}% rain</div>
                  {d.rain_sum > 0 && <div className="text-[10px] text-indigo-600">{d.rain_sum}mm</div>}
                </motion.div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
