/**
 * ForecastChart.jsx — Chart.js line chart showing historical + forecast data
 */

import React from 'react'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  Title, Tooltip, Legend, Filler,
} from 'chart.js'
import { Line } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

export default function ForecastChart({ data }) {
  if (!data) return null

  const { historical_labels, historical_data, forecast_labels, forecast_data } = data

  // Combine labels — there will be a gap between history and forecast
  const allLabels = [...historical_labels, ...forecast_labels]

  // Historical dataset — solid indigo line
  const historicalDs = {
    label:           'Historical Cases',
    data:            [...historical_data, ...Array(forecast_labels.length).fill(null)],
    borderColor:     '#6366f1',
    backgroundColor: 'rgba(99,102,241,0.1)',
    borderWidth:     2.5,
    pointRadius:     3,
    pointHoverRadius:5,
    fill:            true,
    tension:         0.4,
  }

  // Forecast dataset — dashed amber line
  const forecastDs = {
    label:           '7-Day Forecast',
    data:            [...Array(historical_labels.length).fill(null), ...forecast_data],
    borderColor:     '#f59e0b',
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderWidth:     2.5,
    borderDash:      [6, 4],
    pointRadius:     3,
    pointHoverRadius:5,
    fill:            true,
    tension:         0.4,
  }

  const chartData    = { labels: allLabels, datasets: [historicalDs, forecastDs] }

  const options = {
    responsive:          true,
    maintainAspectRatio: false,
    interaction:         { mode: 'index', intersect: false },
    plugins: {
      legend: {
        labels: { color: '#94a3b8', font: { size: 12 }, usePointStyle: true },
      },
      tooltip: {
        backgroundColor: '#1e293b',
        titleColor:      '#f1f5f9',
        bodyColor:       '#94a3b8',
        borderColor:     '#334155',
        borderWidth:     1,
      },
    },
    scales: {
      x: {
        ticks: { color: '#64748b', font: { size: 11 } },
        grid:  { color: 'rgba(100,116,139,0.15)' },
      },
      y: {
        ticks: { color: '#64748b', font: { size: 11 } },
        grid:  { color: 'rgba(100,116,139,0.15)' },
        title: { display: true, text: 'Case Count', color: '#64748b', font: { size: 11 } },
      },
    },
  }

  return (
    <div style={{ height: '320px' }}>
      <Line data={chartData} options={options} />
    </div>
  )
}
