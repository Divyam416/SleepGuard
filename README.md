# SleepGuard: adaptive sleep positional therapy

An ESP32 device that notices sustained back-sleeping, gives a gentle vibration, checks whether the sleeper actually turned over, and uses that response history to pick the next vibration level. A web dashboard shows the readings, the interventions, and how the level adapts.

> **What is new here.** Vibration-based positional therapy already exists. The contribution is the closed loop: the device does not just "vibrate when on back". It waits for the position to be sustained, holds off if the sleeper is already moving, checks the response, and learns the lowest level that works for that person.



## How it works

```
Detect position -> sustained? -> already moving? -> vibrate -> turned over? -> record -> adjust level
```

| Step | Rule |
|---|---|
| Detect | FSR pressure above `onThreshold` for 0.5 s = **Back**; below `offThreshold` = **Side** (hysteresis + debounce) |
| Sustained | On back continuously for `sustainMs` (15 s demo, 5 min real) |
| Already moving? | If the pressure changed sharply in the last `quietMs`, do not vibrate. Log `skipped_moving` and wait |
| Vibrate | Pulse the output at the current level (1 to 5, PWM duty 40 to 255) |
| Response | Success if the sleeper leaves their back within `responseMs` |
| No response | Pause (`cooldownMs`), then retry one level stronger. After 5 attempts, raise an alert and stop until they turn |
| Adapt | Success at a stronger level than the base: base moves up. Three first-try successes in a row: try one level gentler, unless history shows that level rarely works (success rate under 60% over 3+ trials) |

The response history (per-level trials and successes, current base level) is saved in the ESP32's flash, so it survives a reboot. The therapy loop runs entirely on the device; Wi-Fi only uploads results.

## Architecture

```
FSR -> ESP32 (TherapyEngine) -> PWM output (LED / vibration motor)
            |
            +-- Wi-Fi task -> Supabase (PostgreSQL + Realtime) -> React dashboard
                               sensor_data (every 5 s), therapy_events (per intervention)

Simulator (Node.js) -> same tables      (use it before the hardware is ready)
```

## Hardware (minimum)

| Part | Connection |
|---|---|
| ESP32 dev board | USB to PC |
| FSR (square pressure pad) | 3V3 -> FSR -> **GPIO34**; **10 kΩ** from GPIO34 to GND |
| LED (stands in for the vibration motor) | **GPIO25** -> 220 Ω -> LED long leg; short leg -> GND |
| Status LED | On-board LED (GPIO2) lights when Wi-Fi is connected |

Notes: GPIO34 is an ADC1 pin. ADC2 pins stop working while Wi-Fi is on. To use a real vibration motor, drive it through a transistor (or a motor module with a driver board) from GPIO25, never directly from the pin. Place the FSR on the back side of the chest band so lying on your back presses it against the mattress.

## Setup

### 1. Supabase
1. Create a project at supabase.com (your own, not the one from the original repo).
2. SQL Editor: run [`supabase/schema.sql`](supabase/schema.sql). This creates both tables, turns on Realtime, and sets access policies.
3. Authentication settings: for a demo, turn off "Confirm email" so you can sign up and log in immediately.
4. Project Settings -> API: copy the **Project URL** and the **anon / publishable key**.

### 2. Dashboard
```bash
cp .env.example .env        # fill in the URL and key
npm install
npm run dev                 # http://localhost:5173 -> sign up, then log in
```

### 3. Simulator (no hardware needed)
```bash
cd simulator
npm install
cp .env.example .env        # same URL and key
npm start                   # a virtual sleeper + the same adaptive logic
npm run dry                 # prints what it would send, no network
```

### 4. Firmware
1. Arduino IDE with the **esp32 board package** installed. Board: *ESP32 Dev Module*. No extra libraries are needed.
2. Open `esp32/SleepGuard_ESP32/`. Copy `secrets.example.h` to `secrets.h` and fill in Wi-Fi and Supabase values. Use a phone hotspot (2.4 GHz) if the campus network has a login page.
3. **Calibrate first.** Set `CALIBRATION_MODE 1`, upload, open *Tools -> Serial Plotter* (115200). Note the value with nothing on the pad and with it pressed as in real use. Set `onThreshold` about 60% of the way up and `offThreshold` about 40% in `TherapyEngine.h` (`Config::common`). Set `CALIBRATION_MODE 0` again.
4. Upload. The Serial Monitor prints one status line per second.
5. To clear the learned history: hold **BOOT** while pressing **EN**.

For a real night, set `DEMO_MODE 0` (5 min sustain, 2 min response window).

## Demo script (DEMO_MODE 1)

| Do this | Expect |
|---|---|
| Press and hold the FSR for 15 s | LED pulses dimly (level 2); dashboard shows *Vibrating* |
| Release during the pulses | Log: **Turned over**, with response time |
| Hold again and ignore the LED | **No response**, retry one level brighter after 8 s; repeat |
| Release after a brighter level | **Turned over**; "How the level adapts" steps up |
| Do three easy turns in a row | Level steps down by one |
| Wiggle the pressure around the 15 s mark | **Skipped, already moving**; no vibration until you settle |
| Hold through all 5 attempts | **Alert: no response** until you release |

## Tests

```bash
# Therapy logic, on a PC (no ESP32 needed): 11 scenarios
g++ -std=c++11 -Wall -o /tmp/test_engine esp32/tests/test_engine.cpp && /tmp/test_engine

npm run build               # dashboard compiles
cd simulator && npm run dry # simulator logic
```

## Project structure

```
esp32/SleepGuard_ESP32/   SleepGuard_ESP32.ino   sensors, PWM, Wi-Fi task, flash storage
                          TherapyEngine.h        the adaptive logic (hardware independent)
                          secrets.example.h      copy to secrets.h
esp32/tests/              PC tests for the engine
simulator/                therapy simulator (Node.js)
supabase/schema.sql       sensor_data + therapy_events + policies + realtime
src/                      React dashboard (hooks/, components/, charts/, lib/therapyStats.js)
```

## Limitations

- A single FSR separates *back* from *not back*. It cannot tell left from right or stomach. An IMU (MPU6050) would, and `TherapyEngine` only needs a back/not-back signal, so it can replace the FSR without changing the adaptive logic.
- Movement is inferred from pressure changes, not from a motion sensor.
- Open insert access on the database is fine for a lab demo. A real product needs per-device authentication.
- Heart rate, SpO2, snoring, temperature and light are not part of this version; the original review lists them as planned extensions.
- This is a coursework prototype, not a medical device.
