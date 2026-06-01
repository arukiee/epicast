/** Shared options for admin user provisioning (Users + Access requests). */

export const PROVISION_ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'hospital_staff', label: 'Hospital Staff' },
  { value: 'clinic_staff', label: 'Clinic Staff' },
  { value: 'public_health_officer', label: 'Public Health Officer' },
]

export const HYD_AREAS = [
  'Gachibowli', 'Jubilee Hills', 'Banjara Hills', 'Hitech City', 'Madhapur',
  'Kukatpally', 'Secunderabad', 'Ameerpet', 'LB Nagar', 'Uppal',
  'Kondapur', 'Miyapur', 'Begumpet', 'Tarnaka', 'Charminar',
]

export const CLINICS_BY_AREA = {
  Gachibowli: ['AIG Hospital', 'Continental Hospital', 'Medicover Clinic'],
  'Jubilee Hills': ['Apollo Hospital', 'Rainbow Hospital', 'Olive Clinic'],
  'Banjara Hills': ['Care Hospitals', 'Ankura Hospital', 'MaxCure Hospital'],
  'Hitech City': ['Yashoda Hitech', 'Shalini Hospital', 'Primus Clinic'],
  Madhapur: ['Seven Hills Hospital', 'Madhava Clinic', 'Lotus Healthcare'],
  Kukatpally: ['KIMS Hospital', 'Mediwin Hospital', 'SunCare Clinic'],
  Secunderabad: ['Yashoda Hospital', 'Sunshine Hospital', 'Care Clinic'],
  Ameerpet: ['Vijaya Hospital', 'Vaibhav Clinic', 'Ameerpet Health Centre'],
  'LB Nagar': ['Rajeev Gandhi Hospital', 'Sparsh Hospital', 'LB General Clinic'],
  Uppal: ['Uppal General Hospital', 'City Care Clinic', 'Medicity Hospital'],
  Kondapur: ['Aware Gleneagles Hospital', 'Kondapur Health Clinic', 'Synergy Hospitals'],
  Miyapur: ['Citizens Specialty Hospital', 'Miyapur Clinic', 'Amrutha Hospital'],
  Begumpet: ['NIMS', 'Begumpet Health Centre', 'Sterling Hospital'],
  Tarnaka: ['Tarnaka Area Hospital', "St. Theresa's Clinic", 'Osmania General Hospital'],
  Charminar: ['Government General Hospital', 'Charminar Clinic', 'Al-Shifa Hospital'],
}

/** Suggested login id from work email (backend requires unique username). */
export function suggestUsernameFromEmail(email) {
  const raw = (email || '').split('@')[0].toLowerCase()
  let s = raw.replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
  if (!s) s = `user_${Date.now().toString(36)}`
  return s.slice(0, 32)
}

/** One-time password suggestion (min 6 chars for API). */
export function suggestTemporaryPassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789'
  const pick = () => chars[Math.floor(Math.random() * chars.length)]
  let out = ''
  for (let i = 0; i < 10; i += 1) out += pick()
  return `${out}Aa1`
}
