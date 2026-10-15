import React from 'react'
import Dashboard from './components/Dashboard'
import AuthPage from './components/AuthPage'
import { useAuth } from './hooks/useAuth'

export default function App() {
  const { user, loading, signOut } = useAuth()

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#F5F5F7',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            border: '3px solid #E5E5E7',
            borderTopColor: '#1D1D1F',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <div style={{ fontSize: '15px', fontWeight: 600, color: '#1D1D1F', letterSpacing: '-0.02em' }}>
          Loading SleepGuard...
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (!user) return <AuthPage />

  return (
    <div style={{ minHeight: '100vh', background: '#F5F5F7' }}>
      {/* ── Header ──────────────────────────────────── */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: 'rgba(245, 245, 247, 0.8)',
          backdropFilter: 'saturate(180%) blur(20px)',
          WebkitBackdropFilter: 'saturate(180%) blur(20px)',
          borderBottom: '1px solid #E5E5E7',
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            padding: '12px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#1D1D1F',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            </div>
            <div>
              <h1 style={{ fontSize: '15px', fontWeight: 700, margin: 0, lineHeight: 1.2, color: '#1D1D1F', letterSpacing: '-0.02em' }}>
                SleepGuard
              </h1>
              <p style={{ fontSize: '11px', color: '#86868B', margin: 0, letterSpacing: '-0.01em' }}>
                Smart Sleep Monitoring
              </p>
            </div>
          </div>

          {/* Right */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 500,
                padding: '5px 12px',
                borderRadius: '999px',
                background: 'rgba(52, 199, 89, 0.08)',
                border: '1px solid rgba(52, 199, 89, 0.15)',
                color: '#34C759',
                maxWidth: '160px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={user.email}
            >
              {user.email}
            </span>
            <button
              onClick={signOut}
              style={{
                padding: '5px 14px',
                borderRadius: '999px',
                border: '1px solid #E5E5E7',
                background: '#FFFFFF',
                color: '#1D1D1F',
                fontSize: '12px',
                fontWeight: 600,
                fontFamily: 'inherit',
                cursor: 'pointer',
                transition: 'all 0.2s',
                letterSpacing: '-0.01em',
              }}
              onMouseEnter={(e) => { e.target.style.background = '#F5F5F7'; e.target.style.borderColor = '#D1D1D6'; }}
              onMouseLeave={(e) => { e.target.style.background = '#FFFFFF'; e.target.style.borderColor = '#E5E5E7'; }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* ── Dashboard ──────────────────────────────── */}
      <main>
        <Dashboard />
      </main>
    </div>
  )
}
