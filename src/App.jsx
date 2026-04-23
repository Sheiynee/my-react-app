import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import { useApp } from './context/app-context'
import { AuthProvider } from './context/AuthContext'
import Sidebar from './components/Sidebar'
import UserMenu from './components/UserMenu'
import ProtectedRoute from './components/ProtectedRoute'
import ErrorBoundary from './components/ErrorBoundary'
import Dashboard from './pages/Dashboard'
import Projects from './pages/Projects'
import ProjectDetail from './pages/ProjectDetail'
import Notes from './pages/Notes'
import Team from './pages/Team'
import Profile from './pages/Profile'
import Users from './pages/Users'
import Login from './pages/Login'
import './App.css'

function AppShell({ dark, onToggleDark }) {
  const { loading, error } = useApp()

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-black">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-500 dark:text-zinc-400">Loading…</p>
      </div>
    </div>
  )

  if (error) return (
    <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-black">
      <div className="flex flex-col items-center gap-3 max-w-sm text-center px-6">
        <div className="w-12 h-12 bg-red-50 dark:bg-red-500/10 rounded-2xl flex items-center justify-center text-2xl">⚠️</div>
        <p className="text-sm font-medium text-gray-900 dark:text-zinc-100">Failed to connect</p>
        <p className="text-xs text-gray-500 dark:text-zinc-400">{error}</p>
        <button
          className="text-sm font-medium px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors"
          onClick={() => window.location.reload()}
        >Retry</button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-black">
      <Sidebar dark={dark} onToggleDark={onToggleDark} />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-14 flex-shrink-0 flex items-center justify-end px-5 border-b border-gray-200/70 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl">
          <UserMenu dark={dark} onToggleDark={onToggleDark} />
        </header>
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/projects/:id" element={<ProjectDetail />} />
            <Route path="/notes" element={<Notes />} />
            <Route path="/team" element={<Team />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/users" element={<Users />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default function App() {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('theme')
    if (saved) return saved === 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            {/* Discord OAuth callback — Login handles the token param */}
            <Route path="/auth/callback" element={<Login />} />

            {/* Protected routes — everything behind auth */}
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <AppProvider>
                    <AppShell dark={dark} onToggleDark={() => setDark(d => !d)} />
                  </AppProvider>
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
