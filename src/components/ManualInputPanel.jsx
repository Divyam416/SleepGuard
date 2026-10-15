import React, { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Card } from './ui/card'

// Test input: add readings/events by hand. Useful for checking the dashboard
// before the device is connected, or as a backup during a demo.
const field = 'w-full rounded-lg border border-[#E5E5E7] bg-white px-3 py-2 text-[14px] text-[#1D1D1F] outline-none focus:border-[#1D1D1F]'
const label = 'text-[11px] font-semibold text-[#86868B] mb-1 block'
const button = 'rounded-full bg-[#1D1D1F] text-white text-[13px] font-semibold px-5 py-2 hover:bg-black transition-colors disabled:opacity-50'

export default function ManualInputPanel() {
    const [reading, setReading] = useState({ position: 'Back', fsr_raw: 2000, vibration_level: 2, therapy_state: 'MONITORING' })
    const [event, setEvent] = useState({ outcome: 'success', vibration_level: 2, back_duration_s: 15, response_time_s: 3.2 })
    const [msg, setMsg] = useState('')
    const [busy, setBusy] = useState(false)

    async function insert(table, row, what) {
        setBusy(true); setMsg('')
        const { error } = await supabase.from(table).insert([row])
        setBusy(false)
        setMsg(error ? `Could not add ${what}: ${error.message}` : `Added ${what}.`)
    }

    function addReading(e) {
        e.preventDefault()
        const locked = reading.therapy_state === 'LOCKED'
        insert('sensor_data', {
            position: reading.position,
            fsr_raw: Number(reading.fsr_raw),
            movement: 0,
            vibration_level: Number(reading.vibration_level),
            therapy_state: reading.therapy_state,
            alert_status: locked ? 'Persistent back-sleeping - no response' : 'Normal',
        }, 'reading')
    }

    function addEvent(e) {
        e.preventDefault()
        const ok = event.outcome === 'success'
        const skipped = event.outcome === 'skipped_moving'
        const level = Number(event.vibration_level)
        insert('therapy_events', {
            outcome: event.outcome,
            vibration_level: skipped ? null : level,
            back_duration_s: Number(event.back_duration_s),
            responded: ok,
            response_time_s: ok ? Number(event.response_time_s) : null,
            next_level: event.outcome === 'no_response' ? Math.min(level + 1, 5) : level,
        }, 'event')
    }

    const levels = [1, 2, 3, 4, 5]

    return (
        <Card className="p-0 overflow-hidden">
            <details>
                <summary className="cursor-pointer select-none px-6 py-4 text-[14px] font-bold text-[#1D1D1F] tracking-tight">
                    Test input
                    <span className="ml-2 text-[12px] font-medium text-[#AEAEB2]">Add a reading or event by hand</span>
                </summary>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 px-6 pb-6 pt-2 border-t border-[#F0F0F2]">
                    <form onSubmit={addReading} className="flex flex-col gap-3">
                        <h4 className="text-[13px] font-bold text-[#1D1D1F]">Reading</h4>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className={label}>Position</label>
                                <select className={field} value={reading.position} onChange={(e) => setReading({ ...reading, position: e.target.value })}>
                                    <option>Back</option><option>Side</option>
                                </select>
                            </div>
                            <div>
                                <label className={label}>Pressure (0 to 4095)</label>
                                <input className={field} type="number" min="0" max="4095" value={reading.fsr_raw} onChange={(e) => setReading({ ...reading, fsr_raw: e.target.value })} />
                            </div>
                            <div>
                                <label className={label}>Vibration level</label>
                                <select className={field} value={reading.vibration_level} onChange={(e) => setReading({ ...reading, vibration_level: e.target.value })}>
                                    {levels.map((l) => <option key={l}>{l}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={label}>Therapy state</label>
                                <select className={field} value={reading.therapy_state} onChange={(e) => setReading({ ...reading, therapy_state: e.target.value })}>
                                    {['MONITORING', 'VIBRATING', 'WAITING', 'COOLDOWN', 'LOCKED'].map((s) => <option key={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>
                        <button className={`${button} self-start`} disabled={busy}>Add reading</button>
                    </form>

                    <form onSubmit={addEvent} className="flex flex-col gap-3">
                        <h4 className="text-[13px] font-bold text-[#1D1D1F]">Intervention</h4>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className={label}>Outcome</label>
                                <select className={field} value={event.outcome} onChange={(e) => setEvent({ ...event, outcome: e.target.value })}>
                                    <option value="success">Turned over</option>
                                    <option value="no_response">No response</option>
                                    <option value="skipped_moving">Skipped, already moving</option>
                                </select>
                            </div>
                            <div>
                                <label className={label}>Vibration level</label>
                                <select className={field} value={event.vibration_level} onChange={(e) => setEvent({ ...event, vibration_level: e.target.value })}>
                                    {levels.map((l) => <option key={l}>{l}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={label}>Seconds on back</label>
                                <input className={field} type="number" min="0" value={event.back_duration_s} onChange={(e) => setEvent({ ...event, back_duration_s: e.target.value })} />
                            </div>
                            <div>
                                <label className={label}>Response time (s)</label>
                                <input className={field} type="number" min="0" step="0.1" value={event.response_time_s} onChange={(e) => setEvent({ ...event, response_time_s: e.target.value })} />
                            </div>
                        </div>
                        <button className={`${button} self-start`} disabled={busy}>Add intervention</button>
                    </form>

                    {msg && <p className="md:col-span-2 text-[13px] text-[#86868B]" role="status">{msg}</p>}
                </div>
            </details>
        </Card>
    )
}
