import React, { useRef, useEffect } from 'react'

function formatTime(isoStr) {
    if (!isoStr) return ''
    return new Date(isoStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

const SEV = {
    critical: { color: '#FF3B30', bg: 'rgba(255, 59, 48, 0.04)', border: 'rgba(255, 59, 48, 0.12)', icon: 'critical' },
    warning: { color: '#FF9F0A', bg: 'rgba(255, 159, 10, 0.04)', border: 'rgba(255, 159, 10, 0.12)', icon: 'warning' },
    info: { color: '#48484A', bg: 'rgba(72, 72, 74, 0.04)', border: 'rgba(72, 72, 74, 0.08)', icon: 'info' },
}

function AlertIcon({ severity }) {
    if (severity === 'critical') {
        return (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
        )
    }
    if (severity === 'warning') {
        return (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF9F0A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
        )
    }
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#48484A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
    )
}

export default function AlertsPanel({ alerts }) {
    const bottomRef = useRef(null)
    useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [alerts])

    const reversed = [...alerts].reverse()

    return (
        <div
            style={{
                background: '#FFFFFF',
                border: '1px solid #E5E5E7',
                borderRadius: '16px',
                padding: '20px',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
            }}
        >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1D1D1F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                    </svg>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#1D1D1F', letterSpacing: '-0.01em' }}>Alerts</span>
                </div>
                <span
                    style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '3px 10px',
                        borderRadius: '999px',
                        background: alerts.length > 0 ? 'rgba(255, 59, 48, 0.06)' : 'rgba(52, 199, 89, 0.06)',
                        color: alerts.length > 0 ? '#FF3B30' : '#34C759',
                        border: `1px solid ${alerts.length > 0 ? 'rgba(255, 59, 48, 0.15)' : 'rgba(52, 199, 89, 0.15)'}`,
                    }}
                >
                    {alerts.length}
                </span>
            </div>

            {/* List */}
            <div style={{ maxHeight: '320px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {reversed.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '32px 0' }}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#34C759" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 8px' }}>
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                            <polyline points="22 4 12 14.01 9 11.01" />
                        </svg>
                        <p style={{ fontSize: '13px', color: '#86868B' }}>All conditions normal</p>
                    </div>
                ) : (
                    reversed.map((alert, idx) => {
                        const s = SEV[alert.severity] ?? SEV.info
                        return (
                            <div
                                key={alert.id ?? idx}
                                className={idx === 0 ? 'alert-new' : ''}
                                style={{
                                    background: s.bg,
                                    border: `1px solid ${s.border}`,
                                    borderRadius: '10px',
                                    padding: '10px 12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                }}
                            >
                                <span style={{ flexShrink: 0 }}>
                                    <AlertIcon severity={alert.severity} />
                                </span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ fontSize: '12px', fontWeight: 600, color: s.color, margin: 0 }}>
                                        {alert.message}
                                    </p>
                                    <p style={{ fontSize: '11px', color: '#86868B', margin: '2px 0 0 0' }}>
                                        {formatTime(alert.timestamp)}
                                    </p>
                                </div>
                            </div>
                        )
                    })
                )}
                <div ref={bottomRef} />
            </div>
        </div>
    )
}
