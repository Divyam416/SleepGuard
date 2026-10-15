// SleepGuard - Therapy Simulator
// Simulates the ESP32 device AND a sleeper, using the same adaptive logic as the firmware
// (esp32/SleepGuard_ESP32/TherapyEngine.h), with compressed timers so you can watch the
// dashboard react within a minute. Use it to build/demo the dashboard before the hardware
// is wired, or as a fallback if the hardware misbehaves on demo day.
//
//   npm start            -> sends to Supabase
//   npm run dry          -> prints what would be sent (no network, no credentials needed)

import fetch from 'node-fetch'
import * as dotenv from 'dotenv'
dotenv.config()

const DRY = process.argv.includes('--dry')
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const MAX_TICKS = Number(process.env.MAX_TICKS || 0) // 0 = run forever
const TICK_MS = Number(process.env.TICK_MS || 1000)   // 1 tick = 1 simulated second
const SEND_EVERY = 2                                  // send a reading every N ticks

if (!DRY && (!SUPABASE_URL || !SUPABASE_KEY)) {
    console.error('Missing Supabase credentials. Copy .env.example to .env and fill it in (or run `npm run dry`).')
    process.exit(1)
}

// ── Same rules as the firmware (timers in seconds, compressed) ──
const CFG = { sustain: 8, quiet: 3, vibrate: 3, response: 8, cooldown: 4,
              minLevel: 1, maxLevel: 5, initialLevel: 2,
              stepDownStreak: 3, maxAttempts: 5, minTrials: 3, minRate: 0.6 }

// Virtual sleeper: chance of turning over at each vibration level (differs per run)
const sensitivity = Math.random() * 0.25 - 0.1
const P_RESPOND = [0, 0.15, 0.35, 0.6, 0.8, 0.95].map((p, i) => i === 0 ? 0 : Math.min(0.98, Math.max(0.02, p + sensitivity)))

const rnd = (a, b) => a + Math.random() * (b - a)
const rint = (a, b) => Math.floor(rnd(a, b + 1))

// ── Device state ──
const stats = { base: CFG.initialLevel, streak: 0, trials: Array(6).fill(0), succ: Array(6).fill(0) }
let state = 'MONITORING', attempts = 0, lastLevel = 0, vibStart = 0, cdStart = 0
let backSince = 0, lastMove = 0, skipLogged = false, backDurAtTrigger = 0
let peakMove = 0

// ── Virtual sleeper state ──
let pos = 'Side', nextChange = rint(4, 8), respondAt = Infinity, restless = false

function lowerOk(l) {
    return stats.trials[l] < CFG.minTrials || stats.succ[l] / stats.trials[l] >= CFG.minRate
}

function record(level, success) {
    stats.trials[level]++
    if (success) stats.succ[level]++
    if (success) {
        if (level > stats.base) { stats.base = level; stats.streak = 0 }
        else if (level === stats.base && ++stats.streak >= CFG.stepDownStreak) {
            stats.streak = 0
            if (stats.base > CFG.minLevel && lowerOk(stats.base - 1)) stats.base--
        }
    } else stats.streak = 0
}

async function send(table, body) {
    if (DRY) { console.log(`  -> ${table}: ${JSON.stringify(body)}`); return }
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY,
                       ...(SUPABASE_KEY.startsWith('eyJ') ? { Authorization: `Bearer ${SUPABASE_KEY}` } : {}),
                       Prefer: 'return=minimal' },
            body: JSON.stringify(body),
        })
        if (!res.ok) console.error(`  x ${table} failed: ${res.status} ${await res.text()}`)
    } catch (e) { console.error(`  x ${table} failed: ${e.message}`) }
}

function emit(outcome, level, t, responseS) {
    const next = outcome === 'no_response' && attempts < CFG.maxAttempts ? Math.min(level + 1, CFG.maxLevel) : stats.base
    const ev = { outcome, back_duration_s: pos === 'Back' ? t - backSince : backDurAtTrigger,
                 responded: outcome === 'success', next_level: next }
    if (level > 0) ev.vibration_level = level
    if (outcome === 'success') ev.response_time_s = Number(responseS.toFixed(1))
    console.log(`[t=${t}s] EVENT ${outcome}${level ? ' @level ' + level : ''} -> next level ${next}`)
    return send('therapy_events', ev)
}

function userTurnsToSide(t) {
    if (state === 'VIBRATING' || state === 'WAITING') {
        record(lastLevel, true)
        emit('success', lastLevel, t, t - vibStart)
    }
    pos = 'Side'; state = 'MONITORING'; attempts = 0; skipLogged = false; respondAt = Infinity
    nextChange = rint(6, 12); lastMove = t; peakMove = 700
}

async function tick(t) {
    peakMove = Math.max(0, peakMove * 0.7 - 20)

    // ── sleeper behaviour ──
    nextChange--
    if (pos === 'Side' && nextChange <= 0) {
        pos = 'Back'; backSince = t; attempts = 0; skipLogged = false; state = 'MONITORING'
        lastMove = t; peakMove = 800; restless = Math.random() < 0.25
        console.log(`[t=${t}s] sleeper rolls onto their back${restless ? ' (restless)' : ''}`)
    } else if (pos === 'Back') {
        if (restless && t - backSince >= CFG.sustain - 3 && t - backSince <= CFG.sustain + 1) {
            lastMove = t; peakMove = rint(400, 900)
        }
        if (t >= respondAt) userTurnsToSide(t)
        else if (state === 'MONITORING' && Math.random() < 0.015) userTurnsToSide(t) // turns on their own
    }

    // ── device logic (mirrors the firmware) ──
    if (state === 'MONITORING' && pos === 'Back' && t - backSince >= CFG.sustain) {
        if (t - lastMove < CFG.quiet) {
            if (!skipLogged) { skipLogged = true; await emit('skipped_moving', 0, t, 0) }
        } else {
            lastLevel = attempts === 0 ? stats.base : Math.min(lastLevel + 1, CFG.maxLevel)
            attempts++; vibStart = t; backDurAtTrigger = t - backSince; state = 'VIBRATING'
            respondAt = Math.random() < P_RESPOND[lastLevel] ? t + rnd(1.5, 6) : Infinity
            console.log(`[t=${t}s] VIBRATE level ${lastLevel} (attempt ${attempts})`)
        }
    } else if (state === 'VIBRATING' || state === 'WAITING') {
        if (t - vibStart >= CFG.vibrate) state = 'WAITING'
        if (t - vibStart >= CFG.response) {
            record(lastLevel, false)
            await emit('no_response', lastLevel, t, 0)
            respondAt = Infinity
            if (attempts >= CFG.maxAttempts) { state = 'LOCKED'; nextChange = rint(10, 16); respondAt = t + nextChange }
            else { state = 'COOLDOWN'; cdStart = t }
        }
    } else if (state === 'COOLDOWN' && t - cdStart >= CFG.cooldown) state = 'MONITORING'

    // ── periodic reading ──
    if (t % SEND_EVERY === 0) {
        const fsr = pos === 'Back' ? Math.round(2000 + rnd(-200, 250)) : Math.round(rnd(0, 140))
        const reading = { position: pos, fsr_raw: fsr, movement: Math.round(peakMove),
                          vibration_level: stats.base, therapy_state: state,
                          alert_status: state === 'LOCKED' ? 'Persistent back-sleeping - no response' : 'Normal' }
        console.log(`[t=${t}s] ${pos.padEnd(4)} fsr=${String(fsr).padStart(4)} ${state.padEnd(10)} base level ${stats.base}`)
        await send('sensor_data', reading)
    }
}

console.log(`SleepGuard therapy simulator ${DRY ? '(dry run)' : '-> ' + SUPABASE_URL}`)
console.log(`Virtual sleeper sensitivity offset: ${sensitivity.toFixed(2)} (1 tick = ${TICK_MS} ms)\n`)
let t = 0
const timer = setInterval(async () => {
    t++
    await tick(t)
    if (MAX_TICKS && t >= MAX_TICKS) {
        clearInterval(timer)
        console.log('\nHistory (level: successes/trials):', [1, 2, 3, 4, 5].map(l => `${l}: ${stats.succ[l]}/${stats.trials[l]}`).join('  '))
    }
}, TICK_MS)
