-- Schema for the separate `lottery` database (runs INSIDE database "lottery", as role lottery_app).
-- It never touches the Jetsona "postgres" database. Safe to re-run.

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
  action   text not null,                        -- login, logout, draw, action:<type>, state:update, export
  detail   jsonb
);
create index if not exists audit_log_at_idx on audit_log (at desc);

-- The show itself. One row of shared settings + projector command, and one row per player list.
create table if not exists app_state (
  id         boolean primary key default true check (id),   -- single row
  version    bigint not null,                                -- bumped on every save; the app's cache key
  mode       text not null default 'test' check (mode in ('test', 'real')),  -- list the show currently uses
  settings   jsonb not null,                                 -- effects, per-draw plan, odds, card text
  command    jsonb,                                          -- last projector command (spin / continue)
  updated_at timestamptz not null default now()
);

create table if not exists datasets (
  mode        text primary key check (mode in ('test', 'real')),  -- 'test' = rehearsal list, 'real' = uploaded list
  people      jsonb not null default '[]',   -- [{id, name, englishName, department}]
  source_file text not null default '',      -- name of the uploaded XLSX/CSV
  winners     jsonb not null default '[]',   -- [{drawId, personId, name, englishName, department, effect, time, prizeDescription}]
  excluded    jsonb not null default '[]',   -- personIds marked absent
  draw_count  integer not null default 0,
  updated_at  timestamptz not null default now()
);

-- Read-only helpers for SQL / reporting.
create or replace view winners_view as
  select d.mode, w."drawId" as draw_id, w.name, w."englishName" as english_name, w.department,
         w."prizeDescription" as prize, w.effect, to_timestamp(w.time / 1000.0) as won_at
  from datasets d,
       jsonb_to_recordset(d.winners) as w("drawId" text, name text, "englishName" text, department text,
                                         "prizeDescription" text, effect text, time bigint);

create or replace view people_view as
  select d.mode, p.id, p.name, p."englishName" as english_name, p.department
  from datasets d, jsonb_to_recordset(d.people) as p(id text, name text, "englishName" text, department text);
