/**
 * OutbreakMap.jsx — Population-aware Hyderabad Leaflet map
 * Circle size proportional to population.
 * Color intensity driven by risk_score (0–100).
 * Pulse only on RED zones. Rich epidemiological tooltip.
 */

import React, { useEffect, useRef } from 'react'
import L from 'leaflet'

const HYD_CENTER = [17.385, 78.4867]
const HYD_ZOOM   = 12

// Risk-score → colour gradient
function riskColor(score, zone) {
  if (zone === 'RED')    return { fill: '#ef4444', border: '#dc2626', glow: 'rgba(239,68,68,0.5)' }
  if (zone === 'YELLOW') return { fill: '#f59e0b', border: '#d97706', glow: 'rgba(245,158,11,0.4)' }
  return { fill: '#10b981', border: '#059669', glow: 'rgba(16,185,129,0.3)' }
}

// Population → base radius (px). Range: 10–30
function popRadius(population) {
  const minPop = 195_000, maxPop = 1_300_000
  const minR = 10, maxR = 28
  const clamped = Math.max(minPop, Math.min(maxPop, population || 300_000))
  return minR + ((clamped - minPop) / (maxPop - minPop)) * (maxR - minR)
}

function formatNum(n) {
  if (!n && n !== 0) return '—'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'k'
  return String(n)
}

function riskBar(score, color) {
  return `
    <div style="height:4px;background:rgba(255,255,255,0.1);border-radius:4px;margin:4px 0 8px;overflow:hidden;">
      <div style="width:${score}%;height:100%;background:${color};border-radius:4px;transition:width .4s;"></div>
    </div>`
}

function scoreRow(label, val, total = 100, color = '#94a3b8') {
  const pct = Math.round((val / total) * 100)
  return `
    <div style="display:flex;align-items:center;gap:6px;margin:2px 0;">
      <span style="font-size:10px;color:#64748b;width:70px;flex-shrink:0;">${label}</span>
      <div style="flex:1;height:3px;background:rgba(255,255,255,0.08);border-radius:2px;overflow:hidden;">
        <div style="width:${val}%;height:100%;background:${color};opacity:0.8;"></div>
      </div>
      <span style="font-size:10px;color:${color};font-family:monospace;width:28px;text-align:right;">${val}</span>
    </div>`
}

function buildPopup(z, cfg) {
  const bd = z.score_breakdown || {}
  const zoneLabel = z.zone === 'RED' ? '🚨 Critical Outbreak' : z.zone === 'YELLOW' ? '⚠️ Elevated Risk' : '✅ Normal Monitoring'
  const zoneColor = cfg.fill

  const diseasePills = (z.diseases || []).map(d =>
    `<span style="display:inline-block;padding:1px 7px;border-radius:4px;
       background:${zoneColor}22;color:${zoneColor};border:1px solid ${zoneColor}44;
       font-size:10px;margin:2px 2px 0 0;">${d}</span>`
  ).join('')

  const clinicList = (z.clinic_names || []).slice(0, 5).map(c =>
    `<div style="font-size:11px;color:#cbd5e1;padding:1px 0;">· ${c}</div>`
  ).join('') + (z.clinic_count > 5
    ? `<div style="font-size:10px;color:#475569;">+${z.clinic_count - 5} more</div>` : '')

  return `
    <div style="min-width:260px;max-width:300px;font-family:-apple-system,sans-serif;">
      <div style="background:${zoneColor}18;border:1px solid ${zoneColor}44;border-radius:10px;padding:10px 12px;margin-bottom:10px;">
        <div style="font-weight:700;font-size:15px;color:#f1f5f9;margin-bottom:2px;">${z.area_name}</div>
        <div style="font-size:10px;color:#64748b;margin-bottom:6px;">Hyderabad · ${formatNum(z.population)} residents</div>
        <div style="display:inline-block;padding:2px 10px;border-radius:4px;background:${zoneColor}33;color:${zoneColor};font-size:11px;font-weight:700;">${zoneLabel}</div>
      </div>

      <!-- Key metrics -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;font-size:12px;padding:0 4px 8px;">
        <span style="color:#64748b;">Risk Score</span>
        <span style="color:${zoneColor};font-weight:700;font-family:monospace;">${z.risk_score}/100</span>
        <span style="color:#64748b;">Cases/100k</span>
        <span style="color:#e2e8f0;font-family:monospace;">${z.cases_per_100k?.toFixed(1)}</span>
        <span style="color:#64748b;">Total Cases</span>
        <span style="color:#e2e8f0;font-family:monospace;">${(z.total_cases || 0).toLocaleString()}</span>
        <span style="color:#64748b;">Deaths</span>
        <span style="color:#e2e8f0;font-family:monospace;">${(z.total_deaths || 0).toLocaleString()}</span>
        <span style="color:#64748b;">Density</span>
        <span style="color:#e2e8f0;font-family:monospace;">${formatNum(z.density)}/km²</span>
        <span style="color:#64748b;">Clinics</span>
        <span style="color:#e2e8f0;font-family:monospace;">${z.clinic_count}</span>
      </div>

      <!-- Risk score bar -->
      ${riskBar(z.risk_score || 0, zoneColor)}

      <!-- Score breakdown -->
      <div style="padding:0 4px;">
        <div style="font-size:10px;color:#475569;font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Risk Factor Breakdown</div>
        ${scoreRow('Incidence',  Math.round(bd.incidence || 0),  100, '#38bdf8')}
        ${scoreRow('Growth',     Math.round(bd.growth    || 0),  100, '#f59e0b')}
        ${scoreRow('Severity',   Math.round(bd.severity  || 0),  100, '#a78bfa')}
        ${scoreRow('Hospital',   Math.round(bd.hospital  || 0),  100, '#fb923c')}
        ${scoreRow('Neighbors',  Math.round(bd.neighbor  || 0),  100, '#f43f5e')}
        ${scoreRow('Density',    Math.round(bd.density   || 0),  100, '#34d399')}
      </div>

      <!-- Diseases -->
      <div style="padding:8px 4px 4px;">
        <div style="font-size:10px;color:#475569;font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Active Diseases</div>
        <div>${diseasePills}</div>
      </div>

      <!-- Clinics -->
      <div style="padding:6px 4px 2px;border-top:1px solid #1e293b;margin-top:6px;">
        <div style="font-size:10px;color:#475569;font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Reporting Clinics</div>
        ${clinicList}
      </div>

      ${z.is_mobility_hub ? `
        <div style="margin-top:6px;padding:4px 8px;background:rgba(59,130,246,0.12);border:1px solid rgba(59,130,246,0.25);border-radius:6px;font-size:10px;color:#93c5fd;">
          🚉 Mobility Hub — Enhanced transmission risk
        </div>` : ''}
    </div>`
}

export default function OutbreakMap({ zones = [] }) {
  const mapRef       = useRef(null)
  const mapInstance  = useRef(null)
  const markersLayer = useRef(null)

  useEffect(() => {
    if (mapInstance.current) return

    mapInstance.current = L.map(mapRef.current, {
      center: HYD_CENTER, zoom: HYD_ZOOM, preferCanvas: true,
    })

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap © CARTO',
      subdomains: 'abcd', maxZoom: 19,
    }).addTo(mapInstance.current)

    markersLayer.current = L.layerGroup().addTo(mapInstance.current)

    return () => { mapInstance.current?.remove(); mapInstance.current = null }
  }, [])

  useEffect(() => {
    if (!markersLayer.current) return
    markersLayer.current.clearLayers()

    zones.forEach((z) => {
      const cfg    = riskColor(z.risk_score, z.zone)
      const radius = popRadius(z.population)
      // Scale radius by risk score: RED gets +4px boost
      const finalR = z.zone === 'RED' ? radius + 4 : z.zone === 'YELLOW' ? radius + 1 : radius
      // Opacity driven by risk score intensity
      const opacity = 0.45 + (Math.min(z.risk_score || 0, 100) / 100) * 0.40

      // Outer pulse ring — only RED zones
      if (z.zone === 'RED') {
        L.circleMarker([z.latitude, z.longitude], {
          radius: finalR + 9,
          fillColor: cfg.fill,
          color: 'transparent',
          fillOpacity: 0.15,
          interactive: false,
          className: 'pulse-ring',
        }).addTo(markersLayer.current)

        // Second pulse ring
        L.circleMarker([z.latitude, z.longitude], {
          radius: finalR + 16,
          fillColor: cfg.fill,
          color: 'transparent',
          fillOpacity: 0.07,
          interactive: false,
        }).addTo(markersLayer.current)
      }

      // Main circle
      const circle = L.circleMarker([z.latitude, z.longitude], {
        radius:      finalR,
        fillColor:   cfg.fill,
        color:       cfg.border,
        weight:      z.zone === 'RED' ? 2.5 : 1.5,
        opacity:     0.9,
        fillOpacity: opacity,
      })

      circle.bindPopup(buildPopup(z, cfg), { maxWidth: 320, className: 'epicast-popup' })
      markersLayer.current.addLayer(circle)
    })
  }, [zones])

  return (
    <div ref={mapRef} className="w-full rounded-xl overflow-hidden border border-slate-700/50"
      style={{ height: '460px' }} />
  )
}
