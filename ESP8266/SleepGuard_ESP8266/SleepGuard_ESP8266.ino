/*
 * SleepGuard - NodeMCU (ESP8266) version
 *
 * Wiring:
 *   FSR : 3V3 -> FSR -> A0 -> 10k -> GND        (pressed = lying on back)
 *   LED : D1 (GPIO5) -> 220R -> LED long leg, short leg -> GND
 *   On-board LED (D4) lights when Wi-Fi is connected.
 *
 * Differences from the ESP32 version: one core, so uploads happen inside loop()
 * (one short upload per second at most); the 10-bit ADC value is scaled x4 so the
 * thresholds in TherapyEngine.h stay the same as on the ESP32.
 *
 * Setup: copy secrets.example.h -> secrets.h and fill it in.
 */
#include <ESP8266WiFi.h>
#include <WiFiClientSecureBearSSL.h>
#include <ESP8266HTTPClient.h>
#include <EEPROM.h>
#include <memory>
#include "secrets.h"
#include "TherapyEngine.h"

// ───────── Options ─────────
#define CALIBRATION_MODE 0   // 1 = only print FSR values (Serial Plotter) to choose thresholds
#define DEMO_MODE        1   // 1 = short timers for a classroom demo, 0 = realistic overnight timers
#define SEND_INTERVAL_MS 10000

// ───────── Pins ─────────
#define FSR_PIN     A0
#define VIB_PIN     D1       // PWM output -> LED now, motor driver later
#define STATUS_LED  LED_BUILTIN  // active LOW on NodeMCU
#define CLEAR_PIN   0        // FLASH button: hold 3 s while running to clear learned history
#define ADC_SCALE   4        // 10-bit (0..1023) -> 12-bit-like (0..4092)

#if DEMO_MODE
static const sg::Config CFG = sg::Config::demo();
#else
static const sg::Config CFG = sg::Config::real();
#endif
static sg::TherapyEngine engine(CFG);

// ───────── Event queue (kept until uploaded) ─────────
#define QSIZE 16
static sg::Event evQ[QSIZE];
static uint8_t qHead = 0, qCount = 0;
static void qPush(const sg::Event& e) {
  if (qCount == QSIZE) { qHead = (qHead + 1) % QSIZE; qCount--; }  // full: drop oldest
  evQ[(qHead + qCount) % QSIZE] = e;
  qCount++;
}

// ───────── Flash persistence (EEPROM emulation) ─────────
static void loadStats() {
  EEPROM.begin(sizeof(sg::Stats));
  sg::Stats s;
  EEPROM.get(0, s);
  engine.setStats(s);  // ignored automatically if the data is blank or invalid
  Serial.printf("Base vibration level = %d\n", engine.baseLevel());
}
static void saveStats() {
  EEPROM.put(0, engine.stats());
  EEPROM.commit();
}
static void clearStats() {
  for (size_t i = 0; i < sizeof(sg::Stats); i++) EEPROM.write(i, 0xFF);
  EEPROM.commit();
}

// ───────── Supabase upload ─────────
static bool postJson(const char* table, const char* body) {
  std::unique_ptr<BearSSL::WiFiClientSecure> client(new BearSSL::WiFiClientSecure);
  client->setInsecure();  // fine for a lab project; pin the certificate for production
  HTTPClient http;
  String url = String(SUPABASE_URL) + "/rest/v1/" + table;
  if (!http.begin(*client, url)) return false;
  http.setTimeout(8000);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", SUPABASE_KEY);
  if (String(SUPABASE_KEY).startsWith("eyJ")) {  // legacy anon keys are JWTs; new publishable keys are not
    http.addHeader("Authorization", String("Bearer ") + SUPABASE_KEY);
  }
  http.addHeader("Prefer", "return=minimal");
  int code = http.POST(String(body));
  if (code < 200 || code >= 300) {
    Serial.printf("POST %s failed: %d %s\n", table, code,
                  code < 0 ? HTTPClient::errorToString(code).c_str() : http.getString().c_str());
  }
  http.end();
  return code >= 200 && code < 300;
}

static bool sendReading() {
  char body[256];
  snprintf(body, sizeof(body),
           "{\"position\":\"%s\",\"fsr_raw\":%d,\"movement\":%d,\"vibration_level\":%d,"
           "\"therapy_state\":\"%s\",\"alert_status\":\"%s\"}",
           engine.positionName(), engine.fsrSmoothed(), engine.movementRecent(), engine.baseLevel(),
           engine.stateName(), engine.alertText());
  return postJson("sensor_data", body);
}

static bool sendEvent(const sg::Event& e) {
  char body[256];
  const char* outcome = e.outcome == sg::OUT_SUCCESS ? "success"
                        : e.outcome == sg::OUT_NO_RESPONSE ? "no_response" : "skipped_moving";
  int n = snprintf(body, sizeof(body), "{\"outcome\":\"%s\",\"back_duration_s\":%u,\"responded\":%s,\"next_level\":%u",
                   outcome, (unsigned)e.backDurationS, e.outcome == sg::OUT_SUCCESS ? "true" : "false", (unsigned)e.nextLevel);
  if (e.level > 0) n += snprintf(body + n, sizeof(body) - n, ",\"vibration_level\":%u", (unsigned)e.level);
  if (e.outcome == sg::OUT_SUCCESS) n += snprintf(body + n, sizeof(body) - n, ",\"response_time_s\":%.1f", e.responseMs / 1000.0f);
  snprintf(body + n, sizeof(body) - n, "}");
  return postJson("therapy_events", body);
}

// Called every loop; does at most one upload per second so the therapy loop is never blocked for long.
static void network(uint32_t now) {
  static uint32_t lastTry = 0, lastNet = 0, lastSend = 0;
  const bool up = WiFi.status() == WL_CONNECTED;
  digitalWrite(STATUS_LED, up ? LOW : HIGH);

  if (!up) {
    if (now - lastTry > 15000) {
      Serial.println("Wi-Fi down, reconnecting...");
      WiFi.disconnect();
      WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
      lastTry = now;
    }
    return;
  }
  if (now - lastNet < 1000) return;
  lastNet = now;

  if (qCount > 0) {  // events first
    if (sendEvent(evQ[qHead])) {
      qHead = (qHead + 1) % QSIZE;
      qCount--;
      Serial.println("Event uploaded");
    }
    return;
  }
  if (now - lastSend >= SEND_INTERVAL_MS) {
    lastSend = now;
    sendReading();
  }
}

// ───────── Arduino entry points ─────────
void setup() {
  Serial.begin(115200);
  delay(500);
  pinMode(STATUS_LED, OUTPUT);
  digitalWrite(STATUS_LED, HIGH);  // off
  pinMode(CLEAR_PIN, INPUT_PULLUP);
  analogWriteRange(255);
  analogWrite(VIB_PIN, 0);

#if CALIBRATION_MODE
  Serial.println("CALIBRATION MODE: open Serial Plotter. Press the FSR, then release.");
  Serial.println("Choose onThreshold ~60% and offThreshold ~40% of the pressed value, in TherapyEngine.h (Config::common).");
#else
  loadStats();
  WiFi.persistent(false);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.printf("SleepGuard (NodeMCU) running, %s mode\n", DEMO_MODE ? "DEMO" : "REAL");
#endif
}

void loop() {
  const uint32_t now = millis();
  const int raw = analogRead(FSR_PIN) * ADC_SCALE;
  engine.update(now, raw);

#if CALIBRATION_MODE
  Serial.printf("raw:%d smooth:%d on:%d off:%d\n", raw, engine.fsrSmoothed(), CFG.onThreshold, CFG.offThreshold);
  delay(50);
#else
  analogWrite(VIB_PIN, engine.outputDuty(now));

  sg::Event e;
  while (engine.popEvent(e)) {
    qPush(e);
    Serial.printf("EVENT outcome=%d level=%d next=%d\n", e.outcome, e.level, e.nextLevel);
  }
  if (engine.statsDirty()) {
    saveStats();
    engine.clearStatsDirty();
  }

  // Hold the FLASH button for 3 s to clear the learned history and restart.
  static uint32_t held = 0;
  if (digitalRead(CLEAR_PIN) == LOW) {
    if (held == 0) held = now;
    else if (now - held > 3000) {
      clearStats();
      Serial.println("Learned history cleared. Restarting...");
      delay(200);
      ESP.restart();
    }
  } else {
    held = 0;
  }

  network(now);

  static uint32_t lastPrint = 0;
  if (now - lastPrint >= 1000) {
    lastPrint = now;
    Serial.printf("fsr=%4d %-4s %-10s base=%d attempts=%d queued=%d\n", engine.fsrSmoothed(), engine.positionName(),
                  engine.stateName(), engine.baseLevel(), engine.attempts(), qCount);
  }
  delay(20);
#endif
}
