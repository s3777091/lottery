-- Schema for the separate `lottery` database (runs INSIDE database "lottery", as role lottery_app).
-- It never touches the Jetsona "postgres" database. Safe to re-run.

/* ---------------- sign-in history ---------------- */

create table if not exists admins (
  user_id        uuid primary key,              -- id from Supabase Auth (auth.users.id); no FK, different database
  email          text not null,
  first_login_at timestamptz not null default now(),
  last_login_at  timestamptz not null default now(),
  login_count    integer not null default 1
);

create table if not exists audit_log (
  id       bigserial primary key,
  at       timestamptz not null default now(),
  user_id  uuid,
  email    text,
  action   text not null,                        -- login, logout, draw, action:<type>, state:update, mode:<list>, export
  detail   jsonb
);
create index if not exists audit_log_at_idx on audit_log (at desc);

/* ---------------- the show ---------------- */

-- One row: which list the show uses, shared settings and the last projector command.
create table if not exists app_state (
  id         boolean primary key default true check (id),   -- single row
  version    bigint not null,                                -- bumped on every save; the app's cache key
  mode       text not null default 'test' check (mode in ('test', 'real')),
  settings   jsonb not null,                                 -- effects, per-draw plan, odds, card text, test badge
  command    jsonb,                                          -- last projector command (spin / continue)
  updated_at timestamptz not null default now()
);

-- One row per list: 'test' = rehearsal list, 'real' = list uploaded for the event.
create table if not exists datasets (
  mode        text primary key check (mode in ('test', 'real')),
  source_file text not null default '',      -- name of the uploaded XLSX/CSV
  draw_count  integer not null default 0,    -- rounds drawn so far (drives the per-draw plan)
  updated_at  timestamptz not null default now()
);

-- Players of each list, in upload order.
create table if not exists people (
  mode         text not null references datasets (mode) on delete cascade,
  ord          integer not null,             -- position in the uploaded file (0-based)
  id           text not null,                -- app id: "<STT or name>#<n>"
  name         text not null,                -- Họ và Tên
  english_name text not null default '',     -- English Name (shown on the video)
  department   text not null default '',     -- Phòng Ban
  primary key (mode, ord)
);
create index if not exists people_mode_id_idx on people (mode, id);

-- Every winner of each list, in draw order.
create table if not exists winners (
  draw_id     text primary key,
  seq         bigserial,                     -- insertion order
  mode        text not null references datasets (mode) on delete cascade,
  person_id   text not null,
  name        text not null,
  english_name text not null default '',
  department  text not null default '',
  prize       text,                          -- card text for single-winner draws
  effect      text not null,                 -- effect1-female … effect3-male
  time_ms     bigint not null,               -- draw time in epoch ms (as used by the app)
  won_at      timestamptz generated always as (to_timestamp(time_ms / 1000.0)) stored
);
create index if not exists winners_mode_seq_idx on winners (mode, seq);

-- People marked absent ("vắng mặt"): their prize went back and they cannot win again.
create table if not exists absentees (
  mode      text not null references datasets (mode) on delete cascade,
  person_id text not null,
  primary key (mode, person_id)
);

/* ---------------- upgrade from the first version (JSON columns) ---------------- */
-- That version only ever ran against an empty database, so the old columns are dropped without copying.

drop view if exists winners_view;
drop view if exists people_view;
alter table datasets drop column if exists people;
alter table datasets drop column if exists winners;
alter table datasets drop column if exists excluded;
