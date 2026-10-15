import React from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Card } from '../ui/card'

// Success rate of each vibration level, built from the user's response history.
export default function LevelSuccessChart({ perLevel }) {
    const hasData = perLevel.some((l) => l.trials > 0)
    const data = perLevel.map((l) => ({ ...l, name: `Level ${l.level}` }))

    return (
        <Card className="flex flex-col p-6">
            <h3 className="text-[14px] font-bold text-[#1D1D1F] tracking-tight mb-1">Success rate by vibration level</h3>
            <p className="text-[12px] text-[#AEAEB2] mb-4">How often the sleeper turned over at each level</p>
            <div style={{ height: '200px' }}>
                {!hasData ? (
                    <div className="h-full flex items-center justify-center text-[#AEAEB2] text-sm">No interventions yet</div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                            <XAxis dataKey="level" stroke="transparent" tick={{ fill: '#AEAEB2', fontSize: 11 }} />
                            <YAxis domain={[0, 100]} unit="%" stroke="transparent" tick={{ fill: '#AEAEB2', fontSize: 10 }} />
                            <Tooltip
                                cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                                contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#F0F0F2', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}
                                formatter={(v, _n, p) => [`${v}% (${p.payload.successes} of ${p.payload.trials})`, p.payload.name]}
                                labelFormatter={() => ''}
                            />
                            <Bar dataKey="rate" radius={[6, 6, 0, 0]} isAnimationActive={false}>
                                {data.map((d) => (
                                    <Cell key={d.level} fill={d.trials === 0 ? '#E5E5E7' : d.rate >= 60 ? '#34C759' : '#FF9F0A'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </div>
        </Card>
    )
}
