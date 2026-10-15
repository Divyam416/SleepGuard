import React from 'react'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import { Doughnut } from 'react-chartjs-2'
import { Card } from '../ui/card'

ChartJS.register(ArcElement, Tooltip, Legend)

// A pressure pad can tell "on back" from "not on back"; it cannot tell left from right.
const POSITIONS = ['Back', 'Side']
const COLORS = { Back: 'rgba(255, 159, 10, 0.75)', Side: 'rgba(163, 177, 138, 0.8)' }

export default function PositionChart({ history }) {
    const counts = { Back: 0, Side: 0 }
    history.forEach((r) => { if (counts[r.position] != null) counts[r.position]++ })
    const total = counts.Back + counts.Side

    const data = {
        labels: POSITIONS,
        datasets: [{
            data: POSITIONS.map((p) => counts[p]),
            backgroundColor: POSITIONS.map((p) => COLORS[p]),
            borderColor: '#FFFFFF',
            borderWidth: 2,
            hoverOffset: 6,
        }],
    }
    const options = {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
            legend: { position: 'right', labels: { color: '#86868B', padding: 12, font: { size: 12 }, usePointStyle: true, pointStyleWidth: 8 } },
            tooltip: {
                backgroundColor: '#FFFFFF', titleColor: '#86868B', bodyColor: '#1D1D1F',
                borderColor: '#E5E5E7', borderWidth: 1, cornerRadius: 8, padding: 10,
                callbacks: { label: (ctx) => ` ${ctx.label}: ${ctx.parsed} readings (${total ? ((ctx.parsed / total) * 100).toFixed(0) : 0}%)` },
            },
        },
        animation: { duration: 300 },
    }

    return (
        <Card className="flex flex-col p-6">
            <h3 className="text-[14px] font-bold text-[#1D1D1F] tracking-tight mb-1">Time on back</h3>
            <p className="text-[12px] text-[#AEAEB2] mb-4">Share of the last {total || 50} readings</p>
            <div style={{ height: '200px' }}>
                {total === 0 ? (
                    <div className="h-full flex items-center justify-center text-[#AEAEB2] text-sm">Waiting for data...</div>
                ) : (
                    <Doughnut data={data} options={options} />
                )}
            </div>
        </Card>
    )
}
