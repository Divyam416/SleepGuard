import React from 'react'

const CFG = {
    live: { dot: '#34C759', label: 'Live', sub: 'Realtime streaming' },
    connecting: { dot: '#FF9F0A', label: 'Connecting', sub: 'Establishing connection...' },
    offline: { dot: '#FF3B30', label: 'Offline', sub: 'No data received' },
}

export default function StatusIndicator({ status }) {
    const c = CFG[status] ?? CFG.connecting

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
                className="pulse-dot"
                style={{ backgroundColor: c.dot }}
            />
            <div>
                <p style={{ fontSize: '13px', fontWeight: 600, color: c.dot, lineHeight: 1, margin: 0 }}>
                    {c.label}
                </p>
                <p style={{ fontSize: '11px', color: '#86868B', margin: '2px 0 0 0' }}>
                    {c.sub}
                </p>
            </div>
        </div>
    )
}
