/**
 * Layout.jsx — Clean white sidebar matching the LoginPage design language.
 * White bg, black primary colour, gray borders, Inter font.
 */

import React, { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { logout, ensureSession } from '../api.js'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, FileText, TrendingUp, Bell, ScrollText,
  LogOut, Menu, Activity, ChevronRight, Users, Shield, Inbox, X,
} from 'lucide-react'

const ROLE_BADGE = {
  admin:                 { label: 'Admin',    cls: 'bg-red-50 text-red-700 border-red-200'           },
  hospital_staff:        { label: 'Hospital', cls: 'bg-blue-50 text-blue-700 border-blue-200'        },
  clinic_staff:          { label: 'Clinic',   cls: 'bg-violet-50 text-violet-700 border-violet-200'  },
  public_health_officer: { label: 'PHO',      cls: 'bg-green-50 text-green-700 border-green-200'     },
}

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [sessionReady, setSessionReady] = useState(false)
  const navigate = useNavigate()
  const user    = JSON.parse(localStorage.getItem('epicast_user') || '{}')
  const isAdmin = user.role === 'admin'
  const isPHO   = user.role === 'public_health_officer'
  const badge   = ROLE_BADGE[user.role] || { label: user.role, cls: 'bg-gray-100 text-gray-600 border-gray-200' }

  useEffect(() => {
    const id = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    let cancelled = false
    if (!localStorage.getItem('epicast_token')) {
      setSessionReady(true)
      return undefined
    }
    ensureSession()
      .then(() => {
        if (!cancelled) setSessionReady(true)
      })
      .catch(() => {
        if (cancelled) return
        localStorage.removeItem('epicast_token')
        localStorage.removeItem('epicast_user')
        navigate('/login', { replace: true })
      })
    return () => {
      cancelled = true
    }
  }, [navigate])

  const handleLogout = async () => {
    try { await logout() } catch (_) {}
    localStorage.removeItem('epicast_token')
    localStorage.removeItem('epicast_user')
    navigate('/login')
  }

  const NAV_ITEMS = [
    { to: '/dashboard', label: 'Dashboard',      icon: LayoutDashboard, show: true      },
    { to: '/reports',   label: 'Reports',         icon: FileText,        show: !isPHO    },
    { to: '/forecast',  label: 'Forecast',        icon: TrendingUp,      show: true      },
    { to: '/alerts',    label: 'Alerts',          icon: Bell,            show: true      },
    { to: '/users',           label: 'Users',          icon: Users,      show: isAdmin   },
    { to: '/access-requests', label: 'Access Requests', icon: Inbox,     show: isAdmin   },
    { to: '/logs',            label: 'Activity Logs',   icon: ScrollText, show: isAdmin  },
  ].filter(n => n.show)

  const mainItems  = NAV_ITEMS.filter(n => !['Users','Access Requests','Activity Logs'].includes(n.label))
  const adminItems = NAV_ITEMS.filter(n =>  ['Users','Access Requests','Activity Logs'].includes(n.label))

  const NavItem = ({ to, label, icon: Icon }) => (
    <NavLink to={to} onClick={() => setSidebarOpen(false)}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group
         ${isActive
           ? 'bg-black text-white'
           : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`
      }>
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span className="flex-1">{label}</span>
      <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-40 transition-opacity" />
    </NavLink>
  )

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-black flex items-center justify-center shadow-sm">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-bold text-gray-900 text-sm tracking-widest">EPICAST</div>
            <div className="text-[10px] text-gray-400 tracking-wide">Hyderabad · Disease Surveillance</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {mainItems.length > 0 && (
          <>
            <div className="px-2 pb-2">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                Surveillance
              </span>
            </div>
            {mainItems.map(item => <NavItem key={item.to} {...item} />)}
          </>
        )}

        {adminItems.length > 0 && (
          <>
            <div className="px-2 pt-4 pb-2">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                Administration
              </span>
            </div>
            {adminItems.map(item => <NavItem key={item.to} {...item} />)}
          </>
        )}
      </nav>

      {/* User card */}
      <div className="px-3 pb-4 border-t border-gray-100 pt-3">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-200">
          <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {user.username?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-gray-900 truncate">{user.username || 'User'}</div>
            <div className={`text-xs font-medium px-1.5 py-0.5 rounded-full border inline-block mt-0.5 ${badge.cls}`}>
              {badge.label}
            </div>
          </div>
          <button onClick={handleLogout}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all"
            title="Logout">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )

  if (!sessionReady) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <Activity className="w-8 h-8 text-gray-400 animate-pulse mx-auto mb-3" />
          <p className="text-sm text-gray-500">Restoring session…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 flex-shrink-0 flex-col bg-white border-r border-gray-200">
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <motion.div
              className="absolute inset-0 bg-black/40"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              className="relative z-50 w-64 h-full bg-white border-r border-gray-200"
              initial={{ x: -256 }} animate={{ x: 0 }} exit={{ x: -256 }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}>
              <SidebarContent />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center gap-4 px-4 lg:px-6 py-3.5 bg-white border-b border-gray-200 flex-shrink-0">
          <button onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100">
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-green-700 font-medium">Surveillance Active</span>
            <span className="text-xs text-gray-400 hidden sm:block">· Hyderabad</span>
          </div>

          <div className="ml-auto flex items-center gap-4">
            <span className="hidden md:block text-xs font-mono-data text-gray-400">
              {currentTime.toLocaleTimeString('en-IN', { hour12: false })} IST
            </span>
            <div className={`hidden sm:flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${badge.cls}`}>
              <Shield className="w-3 h-3" /> {badge.label}
            </div>
            <span className="text-xs text-gray-400 hidden sm:block">
              {currentTime.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
