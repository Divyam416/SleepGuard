-- SleepGuard: adaptive sleep positional therapy
-- Run this once in Supabase -> SQL Editor (safe to re-run).

-- ─────────────────────────────────────────────────────────────
-- 1. Periodic device readings (every ~5 s)
-- ─────────────────────────────────────────────────────────────
create table if not exists sensor_data (
  id              uuid primary key default gen_random_uuid(),
  position        text,         -- 'Back' | 'Side'  (an FSR can tell back vs not-back, not left/right)
  fsr_raw         integer,      -- smoothed FSR reading, 0-4095
  movement        integer,      -- peak change in FSR over the last ~5 s (movement indicator)
  vibration_level integer,      -- level the device currently starts with (1-5, learned)
  therapy_state   text,         -- MONITORING | VIBRATING | WAITING | COOLDOWN | LOCKED
  alert_status    text,         -- 'Normal' or an alert message
  created_at      timestamptz default now(),

  -- Legacy columns from the original monitoring-only project.
  -- Not used by this version; kept nullable so older tools still work.
  heart_rate       integer,
  oxygen_level     integer,
  snoring_level    text,
  breathing_status text,
  temperature      integer,
  humidity         integer,
  light_level      text
);

-- ─────────────────────────────────────────────────────────────
-- 2. One row per therapy intervention (the adaptive-response log)
-- ─────────────────────────────────────────────────────────────
create table if not exists therapy_events (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz default now(),
  outcome          text not null check (outcome in ('success', 'no_response', 'skipped_moving')),
  vibration_level  integer,        -- 1-5; null when nothing was vibrated (skipped_moving)
  back_duration_s  integer,        -- seconds spent on the back when the event happened
  responded        boolean,        -- did the user leave their back in time?
  response_time_s  numeric(6,1),   -- seconds from vibration start to turning (success only)
  next_level       integer         -- level the device will use next
);

create index if not exists sensor_data_created_at_idx   on sensor_data   (created_at desc);
create index if not exists therapy_events_created_at_idx on therapy_events (created_at desc);

-- Needed for Realtime change detection
alter table sensor_data    replica identity full;
alter table therapy_events replica identity full;

-- ─────────────────────────────────────────────────────────────
-- 3. Realtime: let the dashboard receive new rows instantly
-- ─────────────────────────────────────────────────────────────
do $$
begin
  begin
    alter publication supabase_realtime add table sensor_data;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table therapy_events;
  exception when duplicate_object then null;
  end;
end $$;

-- ─────────────────────────────────────────────────────────────
-- 4. Row Level Security
--    The ESP32 uses the public (anon) key, so inserts are open for the demo.
--    Reading is limited to logged-in dashboard users.
--    For anything beyond a lab project, add a device-specific secret or
--    a Supabase Edge Function instead of open inserts.
-- ─────────────────────────────────────────────────────────────
alter table sensor_data    enable row level security;
alter table therapy_events enable row level security;

drop policy if exists "device can insert readings" on sensor_data;
drop policy if exists "users can read readings"    on sensor_data;
create policy "device can insert readings" on sensor_data
  for insert to anon, authenticated with check (true);
create policy "users can read readings" on sensor_data
  for select to authenticated using (true);

drop policy if exists "device can insert events" on therapy_events;
drop policy if exists "users can read events"    on therapy_events;
create policy "device can insert events" on therapy_events
  for insert to anon, authenticated with check (true);
create policy "users can read events" on therapy_events
  for select to authenticated using (true);

-- Optional: wipe test data before a demo
-- truncate table sensor_data, therapy_events;
