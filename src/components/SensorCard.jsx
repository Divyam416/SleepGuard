import React from 'react'

const STATUS_COLORS = {
    normal: { bg: 'rgba(52, 199, 89, 0.06)', border: 'rgba(52, 199, 89, 0.15)', text: '#34C759', glow: 'rgba(52, 199, 89, 0.3)' },
    warning: { bg: 'rgba(255, 159, 10, 0.06)', border: 'rgba(255, 159, 10, 0.15)', text: '#FF9F0A', glow: 'rgba(255, 159, 10, 0.3)' },
    critical: { bg: 'rgba(255, 59, 48, 0.06)', border: 'rgba(255, 59, 48, 0.15)', text: '#FF3B30', glow: 'rgba(255, 59, 48, 0.3)' },
    neutral: { bg: 'rgba(142, 142, 147, 0.06)', border: 'rgba(142, 142, 147, 0.12)', text: '#8E8E93', glow: 'rgba(142, 142, 147, 0.2)' },
}

function getStatus(type, value) {
    if (value == null || value === '—') return 'neutral'
    switch (type) {
        case 'oxygen':
            if (value < 92) return 'critical'
            if (value < 95) return 'warning'
            return 'normal'
        case 'heart_rate':
            if (value < 50 || value > 100) return 'critical'
            if (value < 55 || value > 90) return 'warning'
            return 'normal'
        case 'temperature':
            if (value < 18 || value > 30) return 'critical'
            if (value < 22 || value > 26) return 'warning'
            return 'normal'
        case 'humidity':
            if (value < 30 || value > 70) return 'critical'
            if (value < 40 || value > 60) return 'warning'
            return 'normal'
        case 'position':
            return value === 'Back' ? 'warning' : 'normal'
        case 'snoring':
            return value === 'Heavy' ? 'critical' : value === 'Mild' ? 'warning' : 'normal'
        case 'light':
            return value === 'Bright' ? 'critical' : value === 'Dim' ? 'warning' : 'normal'
        case 'breathing':
            return value === 'Stopped' ? 'critical' : value === 'Irregular' ? 'warning' : 'normal'
        default:
            return 'neutral'
    }
}

export default function SensorCard({ icon, label, value, unit, type, rawValue }) {
    const statusKey = getStatus(type, rawValue ?? value)
    const colors = STATUS_COLORS[statusKey]
    const displayValue = value != null && value !== '—' ? value : '—'
    const hasData = displayValue !== '—'

    return (
        <div
            style={{
                background: '#FFFFFF',
                border: '1px solid #E5E5E7',
                borderRadius: '16px',
                padding: '20px',
                transition: 'all 0.25s ease',
                position: 'relative',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.06)'
                e.currentTarget.style.borderColor = '#D1D1D6'
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.04)'
                e.currentTarget.style.borderColor = '#E5E5E7'
            }}
        >
            {/* Icon + Status dot */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div
                    style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '18px',
                        background: hasData ? colors.bg : '#F5F5F7',
                        border: `1px solid ${hasData ? colors.border : '#E5E5E7'}`,
                        color: hasData ? colors.text : '#86868B',
                    }}
                >
                    {icon}
                </div>
                <div
                    style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: hasData ? colors.text : '#D1D1D6',
                        boxShadow: hasData ? `0 0 6px ${colors.glow}` : 'none',
                        animation: hasData ? 'pulse-live 2s infinite' : 'none',
                    }}
                />
            </div>

            {/* Label */}
            <p
                style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: '#86868B',
                    marginBottom: '6px',
                }}
            >
                {label}
            </p>

            {/* Value */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px' }}>
                <span
                    key={String(value)}
                    style={{
                        fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
                        fontSize: hasData ? '26px' : '22px',
                        fontWeight: 700,
                        color: hasData ? '#1D1D1F' : '#D1D1D6',
                        animation: hasData ? 'count-up 0.3s ease-out' : 'none',
                        lineHeight: 1,
                        letterSpacing: '-0.02em',
                    }}
                >
                    {displayValue}
                </span>
                {unit && (
                    <span style={{ fontSize: '13px', color: '#86868B', fontWeight: 500 }}>
                        {unit}
                    </span>
                )}
            </div>
        </div>
    )
}
