import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useUser } from '../contexts'

const navItems = [
  { path: '/capture', label: 'Capture', icon: '📝' },
  { path: '/configure', label: 'Configure', icon: '⚙️' },
  { path: '/report', label: 'Report', icon: '📊' },
  { path: '/admin', label: 'Admin', icon: '🔐', adminOnly: true },
]

// Version indicator - increment by 0.0.0.1 with each update
const APP_VERSION = 'v1.0.9.1'

export default function Layout({ children }) {
  const location = useLocation()
  const { currentUser, users, setCurrentUserId } = useUser()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen)
  }

  const closeMenu = () => {
    setIsMenuOpen(false)
  }

  return (
    <div className="flex h-screen">
      {/* Hamburger Menu Button */}
      <button
        onClick={toggleMenu}
        className="fixed top-4 left-4 z-50 p-3 glass rounded-lg shadow-lg hover:bg-cyan-100/50 transition-all border border-cyan-200/50"
        aria-label="Toggle menu"
      >
        <div className="w-6 h-6 flex flex-col justify-center gap-1.5">
          <span className={`block h-0.5 w-full bg-slate-700 transition-all ${isMenuOpen ? 'rotate-45 translate-y-2' : ''}`}></span>
          <span className={`block h-0.5 w-full bg-slate-700 transition-all ${isMenuOpen ? 'opacity-0' : ''}`}></span>
          <span className={`block h-0.5 w-full bg-slate-700 transition-all ${isMenuOpen ? '-rotate-45 -translate-y-2' : ''}`}></span>
        </div>
      </button>

      {/* Overlay */}
      {isMenuOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40"
          onClick={closeMenu}
        ></div>
      )}

      {/* Hamburger Menu Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 glass border-r border-cyan-200/50 flex flex-col shadow-xl z-40 transition-transform duration-300 ${
          isMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-6 border-b border-cyan-200/30">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
            Life Tracker
          </h1>
          <div className="mt-2 text-xs text-slate-500 font-mono bg-slate-100/50 px-2 py-1 rounded inline-block">
            {APP_VERSION}
          </div>
        </div>
        
        {/* User Selector */}
        <div className="p-4 border-b border-cyan-200/30">
          <label className="block text-xs font-semibold text-slate-600 mb-2">
            User
          </label>
          <select
            value={currentUser?.id || ''}
            onChange={(e) => {
              setCurrentUserId(e.target.value)
              closeMenu()
            }}
            className="w-full px-3 py-2 text-sm border border-cyan-300/50 rounded-lg bg-white/80 focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 transition-all"
          >
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </div>
        <nav className="flex-1 p-4 overflow-y-auto">
          <ul className="space-y-2">
            {navItems.map((item) => {
              // Hide admin-only items for non-admins
              if (item.adminOnly && currentUser?.role !== 'admin') {
                return null
              }
              const isActive = location.pathname === item.path
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    onClick={closeMenu}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                      isActive
                        ? 'bg-gradient-to-r from-cyan-400/30 to-blue-400/30 text-cyan-700 font-medium glow shadow-lg border border-cyan-300/50'
                        : 'text-slate-700 hover:bg-cyan-100/30 hover:border hover:border-cyan-200/50'
                    }`}
                  >
                    <span className="text-xl">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto w-full">
        <div className="w-full mx-auto p-4">
          {children}
        </div>
      </main>
    </div>
  )
}
