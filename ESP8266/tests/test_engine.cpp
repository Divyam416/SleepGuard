// Host-side tests for TherapyEngine (no ESP32 needed).
// Build & run:  g++ -std=c++11 -Wall -o /tmp/test_engine esp32/tests/test_engine.cpp && /tmp/test_engine
#include <cstdio>
#include <vector>
#include "../SleepGuard_ESP32/TherapyEngine.h"

using namespace sg;

static int failures = 0;
#define CHECK(cond, msg)                                              \
  do {                                                                \
    if (cond) printf("  PASS  %s\n", msg);                            \
    else { printf("  FAIL  %s   (line %d)\n", msg, __LINE__); failures++; } \
  } while (0)

static const int RELEASED = 0, PRESSED = 2000;

struct Rig {
  TherapyEngine e;
  uint32_t t = 1000;
  std::vector<Event> ev;
  explicit Rig(const Config& c = Config::demo()) : e(c) {}

  void run(int fsr, uint32_t ms) {
    for (uint32_t i = 0; i < ms; i += 20) {
      t += 20;
      e.update(t, fsr);
      Event x;
      while (e.popEvent(x)) ev.push_back(x);
    }
  }
  // Hold `fsr` until the engine reaches `s` (or give up after maxMs).
  bool until(int fsr, State s, uint32_t maxMs = 120000) {
    for (uint32_t i = 0; i < maxMs; i += 20) {
      if (e.state() == s) return true;
      run(fsr, 20);
    }
    return e.state() == s;
  }
  void oscillate(int a, int b, uint32_t ms, uint32_t halfPeriod = 300) {
    for (uint32_t i = 0; i < ms; i += halfPeriod) run(((i / halfPeriod) % 2) ? a : b, halfPeriod);
  }
};

static void test_idle_no_events() {
  printf("\n[1] Idle on side: nothing happens\n");
  Rig r; r.run(RELEASED, 60000);
  CHECK(r.ev.empty(), "no events");
  CHECK(r.e.state() == ST_MONITORING && !r.e.onBack(), "monitoring, position = Side");
}

static void test_short_press_ignored() {
  printf("\n[2] Brief press (shorter than sustain time) is ignored\n");
  Rig r; r.run(RELEASED, 2000); r.run(PRESSED, 8000); r.run(RELEASED, 5000);
  CHECK(r.ev.empty(), "no vibration, no events");
}

static void test_debounce() {
  printf("\n[3] Short spike does not change position (debounce)\n");
  Rig r; r.run(RELEASED, 2000); r.run(PRESSED, 200); r.run(RELEASED, 2000);
  CHECK(!r.e.onBack(), "still Side after 200 ms spike");
}

static void test_success_first_try() {
  printf("\n[4] Back sustained -> vibrate at level 2 -> user turns -> success\n");
  Rig r; r.run(RELEASED, 2000);
  CHECK(r.until(PRESSED, ST_VIBRATING), "vibration starts after sustain time");
  CHECK(r.e.outputDuty(r.t) == 80, "output driven at level-2 duty (80)");
  CHECK(r.e.outputDuty(r.t + 500) == 0, "pulse is off in the gap (gentle pulsing)");
  r.run(PRESSED, 3000);
  r.run(RELEASED, 1500);
  CHECK(r.ev.size() == 1 && r.ev[0].outcome == OUT_SUCCESS, "one success event");
  CHECK(r.ev[0].level == 2, "vibrated at initial level 2");
  CHECK(r.ev[0].responseMs > 2000 && r.ev[0].responseMs < 4500, "response time about 3 s");
  CHECK(r.e.state() == ST_MONITORING && r.e.outputDuty(r.t) == 0, "output off afterwards");
  CHECK(r.e.stats().trials[2] == 1 && r.e.stats().succ[2] == 1, "history updated");
}

static void test_escalate_and_learn() {
  printf("\n[5] No response at 2, then 3, responds at level 4 -> base learns 4\n");
  Rig r; r.run(RELEASED, 2000);
  r.until(PRESSED, ST_VIBRATING);               // attempt 1 (level 2)
  r.until(PRESSED, ST_COOLDOWN);                // fails
  r.until(PRESSED, ST_VIBRATING);               // attempt 2 (level 3)
  r.until(PRESSED, ST_COOLDOWN);
  r.until(PRESSED, ST_VIBRATING);               // attempt 3 (level 4)
  r.run(PRESSED, 2000); r.run(RELEASED, 1500);  // responds
  CHECK(r.ev.size() == 3, "3 events");
  CHECK(r.ev[0].outcome == OUT_NO_RESPONSE && r.ev[0].level == 2 && r.ev[0].nextLevel == 3, "fail @2, next 3");
  CHECK(r.ev[1].outcome == OUT_NO_RESPONSE && r.ev[1].level == 3 && r.ev[1].nextLevel == 4, "fail @3, next 4");
  CHECK(r.ev[2].outcome == OUT_SUCCESS && r.ev[2].level == 4, "success @4");
  CHECK(r.e.baseLevel() == 4, "base level learned = 4");
}

static void test_step_down_after_streak() {
  printf("\n[6] Three easy successes at base level -> tries a gentler level\n");
  Rig r;
  for (int k = 0; k < 3; k++) {
    r.run(RELEASED, 2000);
    r.until(PRESSED, ST_VIBRATING); r.run(PRESSED, 1000); r.run(RELEASED, 1500);
  }
  CHECK(r.ev.size() == 3, "3 success events");
  CHECK(r.e.baseLevel() == 1, "base stepped down 2 -> 1");
}

static void test_step_down_blocked_by_history() {
  printf("\n[7] Step-down blocked when the gentler level has a bad record\n");
  Rig r;
  Stats s = r.e.stats();
  s.base = 3; s.trials[2] = 4; s.succ[2] = 0;  // level 2 failed 4/4 before
  r.e.setStats(s);
  for (int k = 0; k < 3; k++) {
    r.run(RELEASED, 2000);
    r.until(PRESSED, ST_VIBRATING); r.run(PRESSED, 1000); r.run(RELEASED, 1500);
  }
  CHECK(r.e.baseLevel() == 3, "base stays at 3");
}

static void test_locked_after_max_attempts() {
  printf("\n[8] Never responds -> 5 attempts, then LOCKED with alert\n");
  Rig r; r.run(RELEASED, 2000);
  for (int i = 0; i < 5; i++) {
    r.until(PRESSED, ST_VIBRATING);
    if (i < 4) r.until(PRESSED, ST_COOLDOWN);
  }
  r.until(PRESSED, ST_LOCKED);
  CHECK(r.e.state() == ST_LOCKED, "state LOCKED");
  CHECK(r.ev.size() == 5, "5 no-response events");
  CHECK(r.ev[4].level == 5, "last attempt at max level 5");
  CHECK(r.e.baseLevel() == 2 && r.e.stats().streak == 0, "failures do not change the base level");
  const char* a = r.e.alertText();
  CHECK(a[0] == 'P', "alert text set");
  r.run(PRESSED, 30000);
  CHECK(r.ev.size() == 5 && r.e.outputDuty(r.t) == 0, "no more vibration while locked");
  r.run(RELEASED, 1500);
  CHECK(r.e.state() == ST_MONITORING && r.e.alertText()[0] == 'N', "alert clears when user leaves back");
}

static void test_movement_skip() {
  printf("\n[9] User already moving at trigger time -> skip, then vibrate once settled\n");
  Rig r; r.run(RELEASED, 2000); r.run(PRESSED, 12000);
  r.oscillate(1400, 2000, 8000);   // restless around the 15 s mark
  CHECK(r.ev.size() == 1 && r.ev[0].outcome == OUT_SKIPPED_MOVING, "one skipped_moving event");
  CHECK(r.e.state() != ST_VIBRATING, "no vibration while moving");
  r.until(PRESSED, ST_VIBRATING, 30000);
  CHECK(r.e.state() == ST_VIBRATING, "vibrates after movement stops");
}

static void test_turn_away_while_moving() {
  printf("\n[10] Turns away on their own while restless -> no vibration at all\n");
  Rig r; r.run(RELEASED, 2000); r.run(PRESSED, 12000);
  r.oscillate(1400, 2000, 6000);
  r.run(RELEASED, 3000);
  bool vib = false; for (auto& x : r.ev) if (x.outcome != OUT_SKIPPED_MOVING) vib = true;
  CHECK(!vib, "only a skip was logged, nothing vibrated");
}

static void test_persistence_roundtrip() {
  printf("\n[11] Stats can be restored (flash persistence)\n");
  Rig a; Stats s = a.e.stats(); s.base = 4; s.trials[4] = 5; s.succ[4] = 4;
  Rig b; b.e.setStats(s);
  CHECK(b.e.baseLevel() == 4 && b.e.stats().succ[4] == 4, "restored");
  Stats bad = s; bad.version = 99; bad.base = 1;
  Rig c; c.e.setStats(bad);
  CHECK(c.e.baseLevel() == 2, "invalid blob ignored");
}

int main() {
  test_idle_no_events();
  test_short_press_ignored();
  test_debounce();
  test_success_first_try();
  test_escalate_and_learn();
  test_step_down_after_streak();
  test_step_down_blocked_by_history();
  test_locked_after_max_attempts();
  test_movement_skip();
  test_turn_away_while_moving();
  test_persistence_roundtrip();
  printf("\n%s (%d failure%s)\n", failures ? "TESTS FAILED" : "ALL TESTS PASSED", failures, failures == 1 ? "" : "s");
  return failures ? 1 : 0;
}
