/**
 * ForecastPage.jsx — Light theme matching login page
 */
import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getForecast } from '../api.js'
import ForecastChart from '../components/ForecastChart.jsx'
import { TrendingUp, RefreshCw, AlertCircle, Info, BarChart2, Database } from 'lucide-react'

const DISEASES = ['Dengue','Cholera','Malaria','COVID-19','Typhoid','Influenza','Hepatitis A','Leptospirosis']

const DISEASE_PILL = {
  Dengue:'bg-orange-50 text-orange-700 border-orange-200',
  Cholera:'bg-blue-50 text-blue-700 border-blue-200',
  Malaria:'bg-green-50 text-green-700 border-green-200',
  'COVID-19':'bg-red-50 text-red-700 border-red-200',
  Typhoid:'bg-purple-50 text-purple-700 border-purple-200',
  Influenza:'bg-sky-50 text-sky-700 border-sky-200',
  'Hepatitis A':'bg-amber-50 text-amber-700 border-amber-200',
  Leptospirosis:'bg-teal-50 text-teal-700 border-teal-200',
}

export default function ForecastPage() {
  const [selectedDisease, setSelectedDisease] = useState('Dengue')
  const [forecastData, setForecastData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const runForecast = async () => {
    setLoading(true); setError('')
    try { const { data } = await getForecast(selectedDisease); setForecastData(data) }
    catch (err) { setError(err.response?.data?.detail || 'No data. Try another disease.'); setForecastData(null) }
    finally { setLoading(false) }
  }

  const r2 = forecastData?.r2_score
  const r2Color = r2 >= 0.7 ? 'text-green-700' : r2 >= 0.4 ? 'text-amber-700' : 'text-red-700'
  const r2Bg    = r2 >= 0.7 ? 'bg-green-50 border-green-200' : r2 >= 0.4 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'
  const r2Label = r2 >= 0.7 ? 'Good fit' : r2 >= 0.4 ? 'Moderate fit' : 'Poor fit'

  return (
    <div className="space-y-6 fade-in">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Disease Case Forecast</h1>
          <p className="text-sm text-gray-500 mt-0.5">7-day projection using Linear Regression on 14-day historical data</p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 bg-gray-50 text-xs text-gray-500">
          <Database className="w-3.5 h-3.5" /> Deterministic · scikit-learn LinearRegression
        </div>
      </div>

      <div className="glass p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-gray-500" />
          <h2 className="font-semibold text-gray-900 text-sm">Configure Forecast</h2>
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-40">
            <label className="block text-xs text-gray-500 font-medium mb-1.5">Select Disease</label>
            <select value={selectedDisease} onChange={e => setSelectedDisease(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black transition">
              {DISEASES.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
          <button onClick={runForecast} disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 bg-black hover:bg-gray-900 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <BarChart2 className="w-4 h-4" />}
            {loading ? 'Running…' : 'Generate Forecast'}
          </button>
        </div>
        <p className="flex items-center gap-1.5 mt-3 text-xs text-gray-400">
          <Info className="w-3.5 h-3.5" /> Accuracy depends on data completeness. Min 2 data points required.
        </p>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {forecastData && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass p-6 space-y-6">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold ${DISEASE_PILL[forecastData.disease_name] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                  {forecastData.disease_name}
                </span>
                <h2 className="font-bold text-gray-900 text-lg mt-2">Case Projection — 7 Days</h2>
                <p className="text-xs text-gray-500 mt-0.5">Historical: 14 days · Model: {forecastData.model}</p>
              </div>
              <div className={`text-center px-4 py-3 rounded-xl border ${r2Bg}`}>
                <div className="text-xs text-gray-500 mb-0.5">R² Score</div>
                <div className={`text-2xl font-bold font-mono-data ${r2Color}`}>{forecastData.r2_score}</div>
                <div className={`text-xs font-semibold ${r2Color}`}>{r2Label}</div>
              </div>
            </div>
            <ForecastChart data={forecastData} />
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">7-Day Projected Counts</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                {forecastData.forecast_labels.map((label, i) => (
                  <div key={label} className="bg-gray-50 rounded-xl p-3 text-center border border-gray-200">
                    <div className="text-xs text-gray-400 mb-1">{label}</div>
                    <div className="text-lg font-bold text-gray-900 font-mono-data">{forecastData.forecast_data[i]?.toLocaleString() ?? '—'}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">projected</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-start gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-xs text-gray-500">
              <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              Statistical extrapolation only. Does not account for interventions or seasonality changes.
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!forecastData && !loading && !error && (
        <div className="glass p-14 text-center">
          <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-1">Select a disease and click Generate Forecast</p>
          <p className="text-xs text-gray-400">scikit-learn Linear Regression · min 2 data points required</p>
        </div>
      )}
    </div>
  )
}
