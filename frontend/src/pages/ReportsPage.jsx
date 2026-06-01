/**
 * ReportsPage.jsx — Light theme matching login page
 */
import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getReports, reportCase, reportDeath } from '../api.js'
import { FileText, Plus, X, CheckCircle, AlertCircle, RefreshCw, Building2, ChevronDown } from 'lucide-react'

const HYD_CLINICS = [
  {area_id:'HYD-GACHI',area_name:'Gachibowli',clinic_name:'AIG Hospital',lat:17.44,lon:78.3489},
  {area_id:'HYD-GACHI',area_name:'Gachibowli',clinic_name:'Continental Hospital',lat:17.4338,lon:78.3536},
  {area_id:'HYD-GACHI',area_name:'Gachibowli',clinic_name:'Medicover Clinic',lat:17.445,lon:78.352},
  {area_id:'HYD-JUBIL',area_name:'Jubilee Hills',clinic_name:'Apollo Hospital',lat:17.4239,lon:78.4071},
  {area_id:'HYD-JUBIL',area_name:'Jubilee Hills',clinic_name:'Rainbow Hospital',lat:17.43,lon:78.41},
  {area_id:'HYD-JUBIL',area_name:'Jubilee Hills',clinic_name:'Olive Clinic',lat:17.42,lon:78.413},
  {area_id:'HYD-BANJA',area_name:'Banjara Hills',clinic_name:'Care Hospitals',lat:17.4126,lon:78.4482},
  {area_id:'HYD-BANJA',area_name:'Banjara Hills',clinic_name:'Ankura Hospital',lat:17.416,lon:78.444},
  {area_id:'HYD-BANJA',area_name:'Banjara Hills',clinic_name:'MaxCure Hospital',lat:17.418,lon:78.45},
  {area_id:'HYD-HTECH',area_name:'Hitech City',clinic_name:'Yashoda Hitech',lat:17.4486,lon:78.3908},
  {area_id:'HYD-HTECH',area_name:'Hitech City',clinic_name:'Shalini Hospital',lat:17.451,lon:78.395},
  {area_id:'HYD-HTECH',area_name:'Hitech City',clinic_name:'Primus Clinic',lat:17.446,lon:78.387},
  {area_id:'HYD-MADHA',area_name:'Madhapur',clinic_name:'Seven Hills Hospital',lat:17.4525,lon:78.3913},
  {area_id:'HYD-MADHA',area_name:'Madhapur',clinic_name:'Madhava Clinic',lat:17.455,lon:78.394},
  {area_id:'HYD-MADHA',area_name:'Madhapur',clinic_name:'Lotus Healthcare',lat:17.448,lon:78.392},
  {area_id:'HYD-KUKAT',area_name:'Kukatpally',clinic_name:'KIMS Hospital',lat:17.4849,lon:78.4138},
  {area_id:'HYD-KUKAT',area_name:'Kukatpally',clinic_name:'Mediwin Hospital',lat:17.487,lon:78.416},
  {area_id:'HYD-KUKAT',area_name:'Kukatpally',clinic_name:'SunCare Clinic',lat:17.482,lon:78.412},
  {area_id:'HYD-SECUN',area_name:'Secunderabad',clinic_name:'Yashoda Hospital',lat:17.4399,lon:78.4983},
  {area_id:'HYD-SECUN',area_name:'Secunderabad',clinic_name:'Sunshine Hospital',lat:17.442,lon:78.5},
  {area_id:'HYD-SECUN',area_name:'Secunderabad',clinic_name:'Care Clinic',lat:17.437,lon:78.496},
  {area_id:'HYD-AMEER',area_name:'Ameerpet',clinic_name:'Vijaya Hospital',lat:17.4375,lon:78.4483},
  {area_id:'HYD-AMEER',area_name:'Ameerpet',clinic_name:'Vaibhav Clinic',lat:17.4395,lon:78.451},
  {area_id:'HYD-AMEER',area_name:'Ameerpet',clinic_name:'Ameerpet Health Centre',lat:17.436,lon:78.446},
  {area_id:'HYD-LBNGA',area_name:'LB Nagar',clinic_name:'Rajeev Gandhi Hospital',lat:17.3472,lon:78.5511},
  {area_id:'HYD-LBNGA',area_name:'LB Nagar',clinic_name:'Sparsh Hospital',lat:17.349,lon:78.553},
  {area_id:'HYD-LBNGA',area_name:'LB Nagar',clinic_name:'LB General Clinic',lat:17.345,lon:78.549},
  {area_id:'HYD-UPPAL',area_name:'Uppal',clinic_name:'Uppal General Hospital',lat:17.4055,lon:78.5592},
  {area_id:'HYD-UPPAL',area_name:'Uppal',clinic_name:'City Care Clinic',lat:17.407,lon:78.561},
  {area_id:'HYD-UPPAL',area_name:'Uppal',clinic_name:'Medicity Hospital',lat:17.404,lon:78.557},
  {area_id:'HYD-KONDA',area_name:'Kondapur',clinic_name:'Aware Gleneagles',lat:17.46,lon:78.3724},
  {area_id:'HYD-KONDA',area_name:'Kondapur',clinic_name:'Kondapur Health Clinic',lat:17.462,lon:78.375},
  {area_id:'HYD-KONDA',area_name:'Kondapur',clinic_name:'Synergy Hospitals',lat:17.458,lon:78.37},
  {area_id:'HYD-MIYAP',area_name:'Miyapur',clinic_name:'Citizens Specialty',lat:17.4963,lon:78.3553},
  {area_id:'HYD-MIYAP',area_name:'Miyapur',clinic_name:'Miyapur Clinic',lat:17.498,lon:78.357},
  {area_id:'HYD-MIYAP',area_name:'Miyapur',clinic_name:'Amrutha Hospital',lat:17.494,lon:78.353},
  {area_id:'HYD-BEGUM',area_name:'Begumpet',clinic_name:'NIMS',lat:17.435,lon:78.4651},
  {area_id:'HYD-BEGUM',area_name:'Begumpet',clinic_name:'Begumpet Health Centre',lat:17.437,lon:78.467},
  {area_id:'HYD-BEGUM',area_name:'Begumpet',clinic_name:'Sterling Hospital',lat:17.433,lon:78.463},
  {area_id:'HYD-TARNA',area_name:'Tarnaka',clinic_name:'Tarnaka Area Hospital',lat:17.4289,lon:78.5424},
  {area_id:'HYD-TARNA',area_name:'Tarnaka',clinic_name:"St. Theresa's Clinic",lat:17.431,lon:78.544},
  {area_id:'HYD-TARNA',area_name:'Tarnaka',clinic_name:'Osmania General',lat:17.3888,lon:78.4771},
  {area_id:'HYD-CHARM',area_name:'Charminar',clinic_name:'Government General',lat:17.38,lon:78.4741},
  {area_id:'HYD-CHARM',area_name:'Charminar',clinic_name:'Charminar Clinic',lat:17.361,lon:78.472},
  {area_id:'HYD-CHARM',area_name:'Charminar',clinic_name:'Al-Shifa Hospital',lat:17.358,lon:78.47},
]
const DISEASES = ['Dengue','Cholera','Malaria','COVID-19','Typhoid','Influenza','Hepatitis A','Leptospirosis']
const AREAS = [...new Set(HYD_CLINICS.map(c => c.area_name))]
const BLANK = {clinic_key:'',disease_name:'',case_count:'',death_count:'',date:''}

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

const inputCls = 'w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black transition'

export default function ReportsPage() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(BLANK)
  const [formType, setFormType] = useState('case')
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState(null)
  const [visible, setVisible] = useState(50)

  const fetchReports = async () => {
    try { const { data } = await getReports(); setReports(data) }
    catch (_) {} finally { setLoading(false) }
  }
  useEffect(() => { fetchReports() }, [])

  const showToast = (msg, type = 'success') => { setToast({msg,type}); setTimeout(() => setToast(null), 3500) }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const clinic = HYD_CLINICS.find(c => `${c.area_id}::${c.clinic_name}` === form.clinic_key)
    if (!clinic) { showToast('Please select a clinic','error'); return }
    if (!form.disease_name) { showToast('Please select a disease','error'); return }
    
    // Future date validation
    if (form.date && new Date(form.date) > new Date()) {
      showToast('Report date cannot be in the future', 'error')
      return
    }

    // Input values and limits validation
    if (formType === 'death') {
      const deathsToAdd = parseInt(form.death_count) || 0
      if (deathsToAdd <= 0) {
        showToast('Please report a death count greater than zero', 'error')
        return
      }
      if (deathsToAdd > 500) {
        showToast('Death count cannot exceed 500 per report', 'error')
        return
      }
      // Calculate cumulative cases/deaths from local reports matching the clinic and disease
      const clinicReports = reports.filter(r => 
        r.area_id === clinic.area_id && 
        r.clinic_name === clinic.clinic_name && 
        r.disease_name === form.disease_name
      )
      const totalCases = clinicReports.reduce((sum, r) => sum + (r.case_count || 0), 0)
      const totalDeaths = clinicReports.reduce((sum, r) => sum + (r.death_count || 0), 0)
      if (totalDeaths + deathsToAdd > totalCases) {
        showToast(`Invalid report: Cumulative deaths (${totalDeaths + deathsToAdd}) cannot exceed cumulative cases (${totalCases}) for ${form.disease_name} at this clinic.`, 'error')
        return
      }
    } else if (formType === 'case') {
      const casesToAdd = parseInt(form.case_count) || 0
      if (casesToAdd <= 0) {
        showToast('Please report a case count greater than zero', 'error')
        return
      }
      if (casesToAdd > 100000) {
        showToast('Case count cannot exceed 100,000 per report', 'error')
        return
      }
    }

    setSubmitting(true)
    try {
      const payload = {
        area_id: clinic.area_id, area_name: clinic.area_name,
        clinic_name: clinic.clinic_name, latitude: clinic.lat, longitude: clinic.lon,
        disease_name: form.disease_name, date: form.date || undefined,
        ...(formType === 'case'  ? { case_count:  parseInt(form.case_count)  || 0 } : {}),
        ...(formType === 'death' ? { death_count: parseInt(form.death_count) || 0 } : {}),
      }
      formType === 'case' ? await reportCase(payload) : await reportDeath(payload)
      showToast('Report submitted'); setForm(BLANK); setShowForm(false); fetchReports()
    } catch (err) {
      let errMsg = 'Submission failed'
      const detail = err.response?.data?.detail
      if (detail) {
        if (typeof detail === 'string') {
          errMsg = detail
        } else if (Array.isArray(detail)) {
          errMsg = detail.map(d => d.msg || JSON.stringify(d)).join(', ')
        } else {
          errMsg = JSON.stringify(detail)
        }
      }
      showToast(errMsg, 'error')
    } finally { setSubmitting(false) }
  }

  return (
    <div className="space-y-6 fade-in relative">
      <AnimatePresence>
        {toast && (
          <motion.div initial={{opacity:0,x:48}} animate={{opacity:1,x:0}} exit={{opacity:0,x:48}}
            className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-5 py-3 rounded-xl shadow-lg text-sm font-medium border
              ${toast.type==='success'?'bg-green-50 border-green-200 text-green-700':'bg-red-50 border-red-200 text-red-700'}`}>
            {toast.type==='success'?<CheckCircle className="w-4 h-4"/>:<AlertCircle className="w-4 h-4"/>}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hyderabad Clinic Reports</h1>
          <p className="text-sm text-gray-500 mt-0.5">Submit and manage clinic-level outbreak case reports</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchReports} className="p-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 transition"><RefreshCw className="w-4 h-4"/></button>
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-black hover:bg-gray-900 rounded-xl text-white text-sm font-medium transition">
            {showForm ? <X className="w-4 h-4"/> : <Plus className="w-4 h-4"/>}
            {showForm ? 'Cancel' : 'New Report'}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} exit={{opacity:0,height:0}} className="glass p-6 overflow-hidden">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-gray-900">Submit New Report</h2>
              <div className="flex gap-2">
                {[{key:'case',label:'🦠 Case'},{key:'death',label:'☠️ Death'}].map(t => (
                  <button key={t.key} onClick={() => setFormType(t.key)}
                    className={`px-4 py-1.5 rounded-xl text-xs font-medium transition ${formType===t.key?'bg-black text-white':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-500 font-medium mb-1.5">Clinic / Hospital *</label>
                <select value={form.clinic_key} onChange={e => setForm({...form,clinic_key:e.target.value})} className={inputCls}>
                  <option value="">Select clinic…</option>
                  {AREAS.map(area => (
                    <optgroup key={area} label={`— ${area} —`}>
                      {HYD_CLINICS.filter(c => c.area_name===area).map(c => (
                        <option key={`${c.area_id}::${c.clinic_name}`} value={`${c.area_id}::${c.clinic_name}`}>{c.clinic_name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 font-medium mb-1.5">Disease *</label>
                <select value={form.disease_name} onChange={e => setForm({...form,disease_name:e.target.value})} className={inputCls}>
                  <option value="">Select disease…</option>
                  {DISEASES.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              {formType==='case'
                ? <div><label className="block text-xs text-gray-500 font-medium mb-1.5">Case Count</label><input type="number" min="0" value={form.case_count} onChange={e => setForm({...form,case_count:e.target.value})} placeholder="0" className={inputCls}/></div>
                : <div><label className="block text-xs text-gray-500 font-medium mb-1.5">Death Count</label><input type="number" min="0" value={form.death_count} onChange={e => setForm({...form,death_count:e.target.value})} placeholder="0" className={inputCls}/></div>
              }
              <div>
                <label className="block text-xs text-gray-500 font-medium mb-1.5">Report Date <span className="text-gray-400">(optional)</span></label>
                <input type="date" max={new Date().toISOString().split('T')[0]} value={form.date} onChange={e => setForm({...form,date:e.target.value})} className={inputCls}/>
              </div>
              <div className="md:col-span-2 flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => {setShowForm(false);setForm(BLANK)}}
                  className="px-5 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm hover:bg-gray-200 transition">Cancel</button>
                <button type="submit" disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-black hover:bg-gray-900 text-white text-sm font-medium transition disabled:opacity-50">
                  {submitting?'Submitting…':'Submit Report'}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="glass p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-500"/>
            <h2 className="font-semibold text-gray-900 text-sm">All Reports</h2>
            <span className="text-xs text-gray-400 ml-1">({reports.length} total)</span>
          </div>
          <button onClick={fetchReports} className="p-2 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition"><RefreshCw className="w-3.5 h-3.5"/></button>
        </div>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-gray-200 border-t-black rounded-full animate-spin mb-3"/>
            <span className="text-sm text-gray-400">Loading reports…</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  {['#','Clinic','Area','Disease','Cases','Deaths','Date'].map(h => (
                    <th key={h} className="text-left py-2.5 px-3 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reports.slice(0,visible).map((r,i) => (
                  <motion.tr key={r.id} initial={{opacity:0}} animate={{opacity:1}} transition={{delay:Math.min(i*0.008,0.15)}}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-2.5 px-3 text-gray-400 text-xs font-mono-data">#{r.id}</td>
                    <td className="py-2.5 px-3 text-gray-900 font-medium">
                      <div className="flex items-center gap-1.5"><Building2 className="w-3 h-3 text-gray-400"/>{r.clinic_name||'—'}</div>
                    </td>
                    <td className="py-2.5 px-3 text-gray-500 text-xs">{r.area_name}</td>
                    <td className="py-2.5 px-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${DISEASE_PILL[r.disease_name]||'bg-gray-100 text-gray-600 border-gray-200'}`}>{r.disease_name}</span>
                    </td>
                    <td className="py-2.5 px-3 text-gray-900 font-mono-data">{r.case_count?.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-gray-500 font-mono-data">{r.death_count}</td>
                    <td className="py-2.5 px-3 text-gray-400 text-xs font-mono-data">{new Date(r.timestamp).toLocaleDateString('en-IN')}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
            {reports.length===0&&<div className="text-center py-12"><FileText className="w-10 h-10 text-gray-300 mx-auto mb-3"/><p className="text-gray-400 text-sm">No reports yet</p></div>}
            {reports.length>visible&&(
              <div className="text-center pt-4">
                <button onClick={() => setVisible(v=>v+50)} className="flex items-center gap-2 mx-auto px-5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm transition">
                  <ChevronDown className="w-4 h-4"/> Show more ({reports.length-visible} remaining)
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
