import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

const EVENT_LIMIT = 100

// Loads recent therapy interventions and keeps them live via Supabase Realtime.
export function useTherapyEvents() {
    const [events, setEvents] = useState([])

    useEffect(() => {
        if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) return
        let isMounted = true

        supabase
            .from('therapy_events')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(EVENT_LIMIT)
            .then(({ data, error }) => {
                if (error) { console.error('Error fetching therapy events:', error); return }
                if (isMounted && data) setEvents([...data].reverse())
            })

        const channel = supabase
            .channel('therapy_events_realtime')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'therapy_events' },
                (payload) => {
                    if (isMounted) setEvents((prev) => [...prev, payload.new].slice(-EVENT_LIMIT))
                }
            )
            .subscribe()

        return () => {
            isMounted = false
            try { supabase.removeChannel(channel) } catch { /* ignore */ }
        }
    }, [])

    return events
}
