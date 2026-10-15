import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

const HISTORY_LIMIT = 50
const ALERT_LIMIT = 10
const REPEAT_WINDOW_MS = 60_000 // the device re-sends an active alert every few seconds; show it once per minute

function toAlert(row) {
    return {
        id: row.id,
        message: row.alert_status,
        timestamp: row.created_at,
        severity: getSeverity(row),
    }
}

function addAlert(list, alert) {
    const last = list[list.length - 1]
    if (last && last.message === alert.message &&
        new Date(alert.timestamp) - new Date(last.timestamp) < REPEAT_WINDOW_MS) {
        return list
    }
    return [...list, alert].slice(-ALERT_LIMIT)
}

export function useSensorData() {
    const [latestReading, setLatestReading] = useState(null)
    const [history, setHistory] = useState([])
    const [alerts, setAlerts] = useState([])
    const hasCredentials = Boolean(
        import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
    )
    const [status, setStatus] = useState(hasCredentials ? 'connecting' : 'offline') // 'connecting' | 'live' | 'offline'

    useEffect(() => {
        if (!hasCredentials) return

        let isMounted = true

        // ── Fetch last readings ─────────────────────────────────
        async function fetchHistory() {
            try {
                const { data, error } = await supabase
                    .from('sensor_data')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(HISTORY_LIMIT)

                if (error) {
                    console.error('Error fetching sensor history:', error)
                    if (isMounted) setStatus('offline')
                    return
                }

                if (isMounted && data && data.length > 0) {
                    const sorted = [...data].reverse()
                    setHistory(sorted)
                    setLatestReading(sorted[sorted.length - 1])
                    setAlerts(
                        sorted
                            .filter((r) => r.alert_status && r.alert_status !== 'Normal')
                            .reduce((list, r) => addAlert(list, toAlert(r)), [])
                    )
                }
            } catch (err) {
                console.error('Supabase fetch error:', err)
                if (isMounted) setStatus('offline')
            }
        }

        fetchHistory()

        // ── Subscribe to realtime inserts ───────────────────────
        const channel = supabase
            .channel('sensor_data_realtime')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'sensor_data' },
                (payload) => {
                    if (!isMounted) return
                    const row = payload.new
                    setLatestReading(row)
                    setHistory((prev) => [...prev, row].slice(-HISTORY_LIMIT))
                    if (row.alert_status && row.alert_status !== 'Normal') {
                        setAlerts((prev) => addAlert(prev, toAlert(row)))
                    }
                }
            )
            .subscribe((subStatus) => {
                if (subStatus === 'SUBSCRIBED') setStatus('live')
                if (subStatus === 'CLOSED' || subStatus === 'CHANNEL_ERROR') setStatus('offline')
            })

        return () => {
            isMounted = false
            try { supabase.removeChannel(channel) } catch { /* ignore */ }
        }
    }, [hasCredentials])

    return { latestReading, history, alerts, status }
}

function getSeverity(row) {
    if (row.alert_status && row.alert_status.toLowerCase().includes('persistent')) return 'critical'
    return 'info'
}
