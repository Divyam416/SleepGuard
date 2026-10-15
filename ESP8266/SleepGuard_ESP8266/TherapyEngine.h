// TherapyEngine.h
// Adaptive, response-based back-sleeping therapy logic.
// No Arduino/ESP32 dependencies, so it can be unit-tested on a PC
// (see esp32/tests/test_engine.cpp).
//
// Flow:
//   Detect position -> sustained? -> already moving? -> vibrate ->
//   did the user leave the back? -> record response -> adjust level
#pragma once
#include <stdint.h>
#include <stdlib.h>

namespace sg {

enum State : uint8_t {
  ST_MONITORING = 0,  // watching position
  ST_VIBRATING,       // pulsing the output
  ST_WAITING,         // output off, still inside the response window
  ST_COOLDOWN,        // failed attempt, pause before trying a stronger level
  ST_LOCKED           // all attempts used; wait for the user to leave their back
};

enum Outcome : uint8_t { OUT_SUCCESS = 0, OUT_NO_RESPONSE, OUT_SKIPPED_MOVING };

struct Config {
  // --- signal (FSR raw ADC counts, 0..4095) ---
  int onThreshold;   // smoothed value >= this  -> lying on back
  int offThreshold;  // smoothed value <= this  -> not on back (hysteresis gap)
  int moveDelta;     // change within 250 ms larger than this counts as movement
  float smoothAlpha; // EMA factor per update call
  // --- timing (ms) ---
  uint32_t debounceMs;  // position must be stable this long to be accepted
  uint32_t sustainMs;   // time on back before intervening
  uint32_t quietMs;     // no movement for this long before vibrating
  uint32_t vibrateMs;   // how long the output pulses
  uint32_t responseMs;  // total window (from vibration start) to leave the back
  uint32_t cooldownMs;  // pause after a failed attempt
  // --- adaptation ---
  uint8_t minLevel, maxLevel, initialLevel;
  uint8_t stepDownStreak;  // consecutive successes before trying a gentler level
  uint8_t maxAttempts;     // attempts per back-sleeping episode
  uint8_t minTrials;       // trials needed before a level's success rate is trusted
  float minRate;           // a gentler level is only tried if its success rate >= this
  uint8_t duty[6];         // PWM duty (0..255) for levels 1..5 (index 0 unused)

  // Short timers so the whole loop can be shown in a classroom demo.
  static Config demo() {
    Config c = common();
    c.sustainMs = 15000; c.quietMs = 5000; c.vibrateMs = 4000;
    c.responseMs = 15000; c.cooldownMs = 8000;
    return c;
  }
  // Realistic overnight timings.
  static Config real() {
    Config c = common();
    c.sustainMs = 300000; c.quietMs = 10000; c.vibrateMs = 5000;
    c.responseMs = 120000; c.cooldownMs = 180000;
    return c;
  }

 private:
  static Config common() {
    Config c;
    c.onThreshold = 1200; c.offThreshold = 800; c.moveDelta = 300;
    c.smoothAlpha = 0.2f; c.debounceMs = 500;
    c.sustainMs = c.quietMs = c.vibrateMs = c.responseMs = c.cooldownMs = 0;
    c.minLevel = 1; c.maxLevel = 5; c.initialLevel = 2;
    c.stepDownStreak = 3; c.maxAttempts = 5; c.minTrials = 3; c.minRate = 0.6f;
    const uint8_t d[6] = {0, 40, 80, 130, 190, 255};
    for (int i = 0; i < 6; i++) c.duty[i] = d[i];
    return c;
  }
};

// Persistent response history (saved to flash by the sketch).
static const uint8_t STATS_VERSION = 1;
struct Stats {
  uint8_t version;
  uint8_t base;    // level used for the first vibration of an episode
  uint8_t streak;  // consecutive first-try successes at `base`
  uint8_t pad;
  uint16_t trials[6];  // per level 1..5
  uint16_t succ[6];
};

struct Event {
  uint8_t outcome;        // Outcome
  uint8_t level;          // 0 when no vibration happened (skipped)
  uint8_t nextLevel;      // level the engine will use next
  uint16_t backDurationS; // seconds on back when the event happened
  uint32_t responseMs;    // time from vibration start to leaving the back (success only)
};

class TherapyEngine {
 public:
  explicit TherapyEngine(const Config& c) : cfg(c) {
    stats_.version = STATS_VERSION;
    stats_.base = c.initialLevel;
    stats_.streak = 0;
    stats_.pad = 0;
    for (int i = 0; i < 6; i++) { stats_.trials[i] = 0; stats_.succ[i] = 0; }
  }

  // Load saved history; ignored if it looks invalid.
  void setStats(const Stats& s) {
    if (s.version == STATS_VERSION && s.base >= cfg.minLevel && s.base <= cfg.maxLevel) stats_ = s;
  }
  const Stats& stats() const { return stats_; }
  bool statsDirty() const { return dirty_; }
  void clearStatsDirty() { dirty_ = false; }

  // Call every ~20 ms with the raw ADC value.
  void update(uint32_t now, int raw) {
    if (!init_) {
      init_ = true; smooth_ = (float)raw; refVal_ = raw; refTime_ = now;
      peakStart_ = now; pendingSince_ = now;
    }
    smooth_ += ((float)raw - smooth_) * cfg.smoothAlpha;
    const int s = (int)(smooth_ + 0.5f);

    // Movement: compare against the value 250 ms ago.
    if (now - refTime_ >= 250) {
      const int d = abs(s - refVal_);
      if (now - peakStart_ >= 5000) { prevPeak_ = curPeak_; curPeak_ = 0; peakStart_ = now; }
      if (d > curPeak_) curPeak_ = d;
      if (d > cfg.moveDelta) lastMove_ = now;
      refVal_ = s; refTime_ = now;
    }

    // Position with hysteresis, then debounce.
    if (s >= cfg.onThreshold) rawBack_ = true;
    else if (s <= cfg.offThreshold) rawBack_ = false;
    if (rawBack_ != pending_) { pending_ = rawBack_; pendingSince_ = now; }
    if (pending_ != back_ && now - pendingSince_ >= cfg.debounceMs) {
      back_ = pending_;
      lastMove_ = now;  // turning over is movement
      onPositionChange(now);
    }

    switch (state_) {
      case ST_MONITORING:
        if (back_ && now - backSince_ >= cfg.sustainMs) {
          if (now - lastMove_ < cfg.quietMs) {
            // Already moving: don't vibrate, they may be turning on their own.
            if (!skipLogged_) { skipLogged_ = true; push(OUT_SKIPPED_MOVING, 0, 0, now); }
          } else {
            startVibration(now);
          }
        }
        break;
      case ST_VIBRATING:
      case ST_WAITING:
        if (now - vibStart_ >= cfg.vibrateMs) state_ = ST_WAITING;
        if (now - vibStart_ >= cfg.responseMs) onFailure(now);
        break;
      case ST_COOLDOWN:
        if (now - cdStart_ >= cfg.cooldownMs) state_ = ST_MONITORING;
        break;
      case ST_LOCKED:
        break;
    }
  }

  // PWM duty for the vibration output right now (0..255).
  uint8_t outputDuty(uint32_t now) const {
    if (state_ != ST_VIBRATING) return 0;
    return ((now - vibStart_) % 700 < 400) ? cfg.duty[lastLevel_] : 0;
  }

  bool popEvent(Event& e) {
    if (head_ == tail_) return false;
    e = ring_[tail_]; tail_ = (tail_ + 1) % RING;
    return true;
  }

  // --- status for display / upload ---
  bool onBack() const { return back_; }
  const char* positionName() const { return back_ ? "Back" : "Side"; }
  State state() const { return state_; }
  const char* stateName() const {
    switch (state_) {
      case ST_MONITORING: return "MONITORING";
      case ST_VIBRATING:  return "VIBRATING";
      case ST_WAITING:    return "WAITING";
      case ST_COOLDOWN:   return "COOLDOWN";
      default:            return "LOCKED";
    }
  }
  const char* alertText() const {
    return state_ == ST_LOCKED ? "Persistent back-sleeping - no response" : "Normal";
  }
  int fsrSmoothed() const { return (int)(smooth_ + 0.5f); }
  int movementRecent() const { return curPeak_ > prevPeak_ ? curPeak_ : prevPeak_; }
  uint8_t baseLevel() const { return stats_.base; }
  uint8_t lastLevel() const { return lastLevel_; }
  uint8_t attempts() const { return attempts_; }

 private:
  static const uint8_t RING = 8;
  Config cfg;
  Stats stats_;
  bool dirty_ = false;

  bool init_ = false;
  float smooth_ = 0;
  int refVal_ = 0;
  uint32_t refTime_ = 0, peakStart_ = 0, lastMove_ = 0;
  int curPeak_ = 0, prevPeak_ = 0;

  bool rawBack_ = false, pending_ = false, back_ = false;
  uint32_t pendingSince_ = 0, backSince_ = 0;

  State state_ = ST_MONITORING;
  uint32_t vibStart_ = 0, cdStart_ = 0;
  uint8_t attempts_ = 0, lastLevel_ = 0;
  uint16_t backDurAtTrigger_ = 0;
  bool skipLogged_ = false;

  Event ring_[RING];
  uint8_t head_ = 0, tail_ = 0;

  void push(Outcome o, uint8_t level, uint32_t responseMs, uint32_t now) {
    Event e;
    e.outcome = o; e.level = level; e.responseMs = responseMs;
    e.backDurationS = back_ ? (uint16_t)((now - backSince_) / 1000) : backDurAtTrigger_;
    e.nextLevel = nextLevelAfter(o, level);
    ring_[head_] = e; head_ = (head_ + 1) % RING;
    if (head_ == tail_) tail_ = (tail_ + 1) % RING;  // full: drop oldest
  }

  uint8_t nextLevelAfter(Outcome o, uint8_t level) const {
    if (o == OUT_NO_RESPONSE && attempts_ < cfg.maxAttempts)
      return level < cfg.maxLevel ? level + 1 : cfg.maxLevel;
    return stats_.base;
  }

  void onPositionChange(uint32_t now) {
    attempts_ = 0;
    skipLogged_ = false;
    if (back_) {
      backSince_ = now;
    } else {
      if (state_ == ST_VIBRATING || state_ == ST_WAITING) onSuccess(pendingSince_);
      backSince_ = 0;
    }
    state_ = ST_MONITORING;
  }

  void startVibration(uint32_t now) {
    uint8_t level = stats_.base;
    if (attempts_ > 0) level = lastLevel_ < cfg.maxLevel ? lastLevel_ + 1 : cfg.maxLevel;
    attempts_++;
    lastLevel_ = level;
    vibStart_ = now;
    backDurAtTrigger_ = (uint16_t)((now - backSince_) / 1000);
    state_ = ST_VIBRATING;
  }

  void onSuccess(uint32_t leftAt) {
    const uint32_t rt = leftAt > vibStart_ ? leftAt - vibStart_ : 0;
    record(lastLevel_, true);
    push(OUT_SUCCESS, lastLevel_, rt, leftAt);
  }

  void onFailure(uint32_t now) {
    record(lastLevel_, false);
    push(OUT_NO_RESPONSE, lastLevel_, 0, now);
    if (attempts_ >= cfg.maxAttempts) {
      state_ = ST_LOCKED;
    } else {
      state_ = ST_COOLDOWN;
      cdStart_ = now;
    }
  }

  // Adaptation rule:
  //  - success at a higher level than base  -> base moves up (learned what works)
  //  - stepDownStreak first-level successes -> try one level gentler, unless that
  //    gentler level has a poor track record in the history
  //  - failure resets the streak
  void record(uint8_t level, bool success) {
    stats_.trials[level]++;
    if (success) stats_.succ[level]++;
    if (success) {
      if (level > stats_.base) {
        stats_.base = level; stats_.streak = 0;
      } else if (level == stats_.base) {
        if (++stats_.streak >= cfg.stepDownStreak) {
          stats_.streak = 0;
          if (stats_.base > cfg.minLevel && lowerOk(stats_.base - 1)) stats_.base--;
        }
      }
    } else {
      stats_.streak = 0;
    }
    dirty_ = true;
  }

  bool lowerOk(uint8_t lvl) const {
    if (stats_.trials[lvl] < cfg.minTrials) return true;  // not enough evidence: allow a try
    return (float)stats_.succ[lvl] / (float)stats_.trials[lvl] >= cfg.minRate;
  }
};

}  // namespace sg

// Values shared between the therapy loop and the Wi-Fi task. Defined here, not in the .ino,
// because the Arduino IDE inserts auto-generated function prototypes above any type defined in the .ino.
struct Snapshot {
  const char* position;
  int fsr;
  int movement;
  int level;
  const char* state;
  const char* alert;
};
