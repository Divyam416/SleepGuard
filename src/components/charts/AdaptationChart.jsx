import React, { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Card } from '../ui/card'

// The novelty made visible: the level the device plans to use next, after each intervention.
export default function AdaptationChart({ tried }) {
    const data = useMemo(
        () => tried.slice(-30).map((e, i) => ({
            n: i + 1,
            next: e.next_level,
            used: e.vibration_level,
            outcome: e.outcome,
            time: e.created_at ? new Date(e.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
        })),
        [tried]
    )

    return (
        <Card className="flex flex-col p-6">
            <h3 className="text-[14px] font-bold text-[#1D1D1F] tracking-tight mb-1">How the level adapts</h3>
            <p className="text-[12px] text-[#AEAEB2] mb-4">Level the device will use next, after each intervention</p>
            <div style={{ height: '200px' }}>
                {data.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-[#AEAEB2] text-sm">No interventions yet</div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data} margin={{ top: 5, right: 8, left: -24, bottom: 0 }}>
                            <XAxis dataKey="n" stroke="transparent" tick={{ fill: '#AEAEB2', fontSize: 10 }} />
                            <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} stroke="transparent" tick={{ fill: '#AEAEB2', fontSize: 10 }} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#F0F0F2', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}
                                formatter={(v, _n, p) => [`Level ${v} next (vibrated at ${p.payload.used}, ${p.payload.outcome.replace('_', ' ')})`, '']}
                                labelFormatter={(n) => `Intervention ${n}`}
                            />
                            <Line type="stepAfter" dataKey="next" stroke="#5E5CE6" strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </div>
        </Card>
    )
}
