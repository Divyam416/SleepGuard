import React, { useMemo, useState, useEffect } from 'react'
import ManualInputPanel from './ManualInputPanel'
import PositionChart from './charts/PositionChart'
import LevelSuccessChart from './charts/LevelSuccessChart'
import AdaptationChart from './charts/AdaptationChart'
import { useSensorData } from '../hooks/useSensorData'
import { useTherapyEvents } from '../hooks/useTherapyEvents'
import { summarizeEvents, backShare, STATE_LABEL } from '../lib/therapyStats'
import { Card, CardHeader, CardTitle, CardContent } from './ui/card'
import {
    LineChart, Line, XAxis, YAxis,
    Tooltip as RechartsTooltip, ResponsiveContainer
} from 'recharts'
import {
    Activity, Moon, Vibrate, Radio, BedDouble, Target, Gauge, Timer, AlertTriangle
} from 'lucide-react'

/* ── MetricCard ─────────────────────────────────────── */
function MetricCard({ title, value, unit, icon, description, valueColor, iconBg }) {
    return (
        <Card className="flex flex-col justify-between p-6">
            <div className="flex justify-between items-start w-full">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl" style={{ backgroundColor: iconBg || '#F5F5F7' }}>
                    {icon}
                </div>
                <span className="text-[10px] font-bold tracking-[0.08em] uppercase text-[#86868B] mt-2">
                    {title}
                </span>
            </div>

            <div className="flex flex-col mt-6">
                <div className="flex items-baseline gap-1">
                    <span className={`text-[28px] font-bold leading-none tracking-tight ${valueColor || 'text-[#1D1D1F]'}`}>
                        {value != null && value !== '—' ? value : '—'}
                    </span>
                    {unit && value !== '—' && value != null && (
                        <span className="text-[13px] font-semibold text-[#86868B]">{unit}</span>
                    )}
                </div>
                {description && (
                    <span className="text-[12px] font-medium text-[#AEAEB2] mt-2">{description}</span>
                )}
            </div>
        </Card>
    )
}

/* ── RealtimeChart ──────────────────────────────────── */
const RealtimeChart = React.memo(function RealtimeChart({ data, title, subtitle, dataKey, lineColor, unit, legendName, yDomain }) {
    const chartData = useMemo(() => {
        if (!data || data.length === 0) return []
        return data.slice(-30).map((d) => ({
            time: d.created_at ? new Date(d.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '',
            [dataKey]: d[dataKey],
        }))
    }, [data, dataKey])

    return (
        <Card className="flex flex-col p-6">
            <h3 className="text-[14px] font-bold text-[#1D1D1F] tracking-tight mb-1">{title}</h3>
            {subtitle && <p className="text-[12px] text-[#AEAEB2] mb-4">{subtitle}</p>}
            <div style={{ width: '100%', height: '200px' }}>
                {chartData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-[#AEAEB2] text-sm">Waiting for data...</div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                            <XAxis
                                dataKey="time" stroke="transparent" tick={{ fill: '#AEAEB2', fontSize: 10 }}
                                tickFormatter={(t) => { const p = t.split(':'); return p.length >= 3 ? `${p[1]}:${p[2]}` : t }}
                            />
                            <YAxis stroke="transparent" tick={{ fill: '#AEAEB2', fontSize: 10 }} domain={yDomain || ['auto', 'auto']} />
                            <RechartsTooltip
                                contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#F0F0F2', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', fontSize: '12px', fontWeight: 600 }}
                                itemStyle={{ color: '#1D1D1F' }}
                                labelStyle={{ color: '#86868B', fontWeight: 500, marginBottom: '4px' }}
                                formatter={(value) => [`${value}${unit || ''}`, legendName]}
                            />
                            <Line type="monotone" dataKey={dataKey} stroke={lineColor} strokeWidth={2.5} dot={false} name={legendName} isAnimationActive={false} />
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </div>
        </Card>
    )
})

/* ── Intervention outcome pill ──────────────────────── */
const OUTCOME = {
    success: { label: 'Turned over', cls: 'bg-[rgba(52,199,89,0.1)] text-[#248A3D]' },
    no_response: { label: 'No response', cls: 'bg-[rgba(255,59,48,0.08)] text-[#FF3B30]' },
    skipped_moving: { label: 'Skipped, already moving', cls: 'bg-[rgba(255,159,10,0.1)] text-[#B26A00]' },
}

function useNow(ms) {
    const [now, setNow] = useState(() => Date.now())
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), ms)
        return () => clearInterval(id)
    }, [ms])
    return now
}

/* ── Dashboard ──────────────────────────────────────── */
export default function Dashboard() {
    const { latestReading: d, history, alerts, status } = useSensorData()
    const events = useTherapyEvents()
    const now = useNow(5000)

    const summary = useMemo(() => summarizeEvents(events), [events])
    const share = backShare(history)

    const ageS = d?.created_at ? Math.max(0, Math.round((now - new Date(d.created_at).getTime()) / 1000)) : null
    const deviceOnline = ageS != null && ageS < 20

    const state = d?.therapy_state
    const stateColor = state === 'LOCKED' ? 'text-[#FF3B30]' : state === 'VIBRATING' ? 'text-[#FF9F0A]' : 'text-[#1D1D1F]'

    return (
        <div className="min-h-screen w-full p-4 md:p-8 flex flex-col gap-6 max-w-[1200px] mx-auto pb-20">
            {/* ── Title ───────────────────────────────── */}
            <div className="pt-10 pb-8 text-center flex flex-col items-center">
                <h1 className="text-[36px] md:text-[52px] font-bold tracking-tight leading-[1.1]" style={{ letterSpacing: '-0.04em' }}>
                    <span className="text-[#1D1D1F]">A gentle nudge.</span>
                    <br />
                    <span className="text-[#86868B]">That learns how you respond.</span>
                </h1>
                <p className="text-[#86868B] text-[15px] max-w-[520px] mt-6 leading-relaxed font-medium">
                    Detects sustained back-sleeping, vibrates, checks whether you turned over, and adjusts the next vibration to fit.
                </p>
            </div>

            <ManualInputPanel />

            {/* ── Live status ─────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <MetricCard
                    title="Position"
                    value={d?.position ?? '—'}
                    valueColor={d?.position === 'Back' ? 'text-[#FF9F0A]' : undefined}
                    icon={<Moon className="h-5 w-5 text-[#5E5CE6]" />}
                    iconBg="rgba(94,92,230,0.06)"
                    description={d?.fsr_raw != null ? `Pressure reading ${d.fsr_raw}` : 'Waiting for the device'}
                />
                <MetricCard
                    title="Therapy"
                    value={state ? (STATE_LABEL[state] ?? state) : '—'}
                    valueColor={stateColor}
                    icon={<Activity className="h-5 w-5 text-[#34C759]" />}
                    iconBg="rgba(52,199,89,0.06)"
                    description={d?.movement != null ? `Recent movement ${d.movement}` : 'Current state of the device'}
                />
                <MetricCard
                    title="Vibration level"
                    value={d?.vibration_level ?? '—'}
                    unit="/ 5"
                    icon={<Vibrate className="h-5 w-5 text-[#D57FF5]" />}
                    iconBg="rgba(213,127,245,0.08)"
                    description="Learned starting level"
                />
                <MetricCard
                    title="Device"
                    value={d ? (deviceOnline ? 'Online' : 'No recent data') : (status === 'offline' ? 'Offline' : 'Waiting')}
                    valueColor={deviceOnline ? 'text-[#248A3D]' : 'text-[#86868B]'}
                    icon={<Radio className="h-5 w-5 text-[#007AFF]" />}
                    iconBg="rgba(0,122,255,0.06)"
                    description={ageS != null ? `Last reading ${ageS}s ago` : 'No readings received yet'}
                />
            </div>

            {/* ── Therapy results ─────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <MetricCard
                    title="Time on back"
                    value={share ?? '—'}
                    unit="%"
                    icon={<BedDouble className="h-5 w-5 text-[#FF9F0A]" />}
                    iconBg="rgba(255,159,10,0.08)"
                    description="Of the recent readings"
                />
                <MetricCard
                    title="Interventions"
                    value={summary.interventions}
                    icon={<Target className="h-5 w-5 text-[#5E5CE6]" />}
                    iconBg="rgba(94,92,230,0.06)"
                    description={`${summary.skipped} skipped because the sleeper was already moving`}
                />
                <MetricCard
                    title="Success rate"
                    value={summary.successRate ?? '—'}
                    unit="%"
                    icon={<Gauge className="h-5 w-5 text-[#34C759]" />}
                    iconBg="rgba(52,199,89,0.06)"
                    description={`${summary.successes} of ${summary.interventions} led to a turn`}
                />
                <MetricCard
                    title="Avg. response"
                    value={summary.avgResponse != null ? summary.avgResponse.toFixed(1) : '—'}
                    unit="s"
                    icon={<Timer className="h-5 w-5 text-[#007AFF]" />}
                    iconBg="rgba(0,122,255,0.06)"
                    description="From vibration to turning over"
                />
            </div>

            {/* ── Charts ──────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-2">
                <AdaptationChart tried={summary.tried} />
                <LevelSuccessChart perLevel={summary.perLevel} />
                <RealtimeChart
                    data={history}
                    title="Pressure under the back"
                    subtitle="Higher means more weight on the pad"
                    dataKey="fsr_raw"
                    lineColor="#FF9F0A"
                    legendName="FSR"
                    yDomain={[0, 4095]}
                />
                <PositionChart history={history} />
            </div>

            {/* ── Logs ────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-2">
                <Card className="max-h-[420px] flex flex-col overflow-hidden">
                    <CardHeader className="px-6 py-5 border-b border-[#F0F0F2]">
                        <CardTitle className="text-[14px] font-bold text-[#1D1D1F] tracking-tight">Intervention log</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 flex-1 overflow-y-auto">
                        {events.length === 0 ? (
                            <p className="p-6 text-center text-[#AEAEB2]">No interventions yet. Stay on your back for a while.</p>
                        ) : (
                            <div className="divide-y divide-[#F0F0F2]">
                                {[...events].reverse().slice(0, 20).map((e) => {
                                    const o = OUTCOME[e.outcome] ?? { label: e.outcome, cls: 'bg-[#F5F5F7] text-[#48484A]' }
                                    return (
                                        <div key={e.id} className="flex items-center justify-between gap-4 px-6 py-4 hover:bg-[#FAFAFA] transition-colors">
                                            <div className="flex flex-col gap-1.5">
                                                <span className={`self-start text-[12px] font-semibold px-2.5 py-0.5 rounded-full ${o.cls}`}>{o.label}</span>
                                                <span className="text-[13px] text-[#86868B]">
                                                    {e.vibration_level ? `Level ${e.vibration_level}` : 'No vibration'}
                                                    {e.back_duration_s != null ? ` after ${e.back_duration_s}s on back` : ''}
                                                    {e.response_time_s != null ? `, turned in ${Number(e.response_time_s).toFixed(1)}s` : ''}
                                                    {e.next_level != null ? `. Next: level ${e.next_level}` : ''}
                                                </span>
                                            </div>
                                            <span className="text-xs font-medium text-[#AEAEB2] shrink-0">
                                                {e.created_at ? new Date(e.created_at).toLocaleTimeString() : ''}
                                            </span>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {alerts.length > 0 ? (
                    <Card className="flex flex-col overflow-hidden max-h-[420px]">
                        <CardHeader className="px-6 py-5 border-b border-[#F0F0F2]">
                            <CardTitle className="text-[14px] font-bold text-[#1D1D1F] tracking-tight flex items-center justify-between">
                                Alerts
                                <span className="text-[11px] font-bold bg-[rgba(255,59,48,0.08)] text-[#FF3B30] px-2.5 py-0.5 rounded-full border border-[rgba(255,59,48,0.15)]">
                                    {alerts.length}
                                </span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0 overflow-y-auto">
                            <div className="divide-y divide-[#F0F0F2]">
                                {[...alerts].reverse().map((a, i) => (
                                    <div key={a.id || i} className="flex items-center justify-between px-6 py-4 hover:bg-[#FAFAFA] transition-colors gap-4">
                                        <div className="flex items-center gap-3.5">
                                            <div className={`p-1.5 rounded-lg ${a.severity === 'critical' ? 'bg-[rgba(255,59,48,0.08)] text-[#FF3B30]' : 'bg-[rgba(255,159,10,0.08)] text-[#FF9F0A]'}`}>
                                                <AlertTriangle className="h-4 w-4" />
                                            </div>
                                            <span className={`text-[14px] font-medium leading-tight ${a.severity === 'critical' ? 'text-[#FF3B30]' : 'text-[#FF9F0A]'}`}>
                                                {a.message}
                                            </span>
                                        </div>
                                        <span className="text-[12px] font-medium text-[#AEAEB2] whitespace-nowrap shrink-0">
                                            {a.timestamp ? new Date(a.timestamp).toLocaleTimeString() : ''}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <Card className="flex flex-col items-center justify-center p-6 text-[#86868B]">
                        <div className="p-3 rounded-full bg-[#F5F5F7] mb-3">
                            <AlertTriangle className="h-6 w-6 text-[#AEAEB2]" />
                        </div>
                        <span className="text-sm font-medium">No alerts</span>
                    </Card>
                )}
            </div>

            <div className="text-center text-[#AEAEB2] text-xs py-8 mt-4">
                SleepGuard · adaptive sleep positional therapy · ESP32 + Supabase
            </div>
        </div>
    )
}
