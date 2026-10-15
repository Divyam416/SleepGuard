// Summary numbers derived from the therapy_events log.
export const LEVELS = [1, 2, 3, 4, 5]

export function summarizeEvents(events) {
    const tried = events.filter((e) => e.outcome === 'success' || e.outcome === 'no_response')
    const successes = tried.filter((e) => e.outcome === 'success')
    const skipped = events.filter((e) => e.outcome === 'skipped_moving').length

    const times = successes.map((e) => Number(e.response_time_s)).filter((n) => Number.isFinite(n))
    const avgResponse = times.length ? times.reduce((a, b) => a + b, 0) / times.length : null

    const perLevel = LEVELS.map((level) => {
        const atLevel = tried.filter((e) => e.vibration_level === level)
        const ok = atLevel.filter((e) => e.outcome === 'success').length
        return { level, trials: atLevel.length, successes: ok, rate: atLevel.length ? Math.round((ok / atLevel.length) * 100) : 0 }
    })

    return {
        interventions: tried.length,
        successes: successes.length,
        successRate: tried.length ? Math.round((successes.length / tried.length) * 100) : null,
        avgResponse,
        skipped,
        perLevel,
        tried,
    }
}

// Share of readings in which the sleeper was on their back.
export function backShare(history) {
    const known = history.filter((r) => r.position === 'Back' || r.position === 'Side')
    if (known.length === 0) return null
    return Math.round((known.filter((r) => r.position === 'Back').length / known.length) * 100)
}

export const STATE_LABEL = {
    MONITORING: 'Monitoring',
    VIBRATING: 'Vibrating',
    WAITING: 'Waiting for response',
    COOLDOWN: 'Cooling down',
    LOCKED: 'Alert: no response',
}
