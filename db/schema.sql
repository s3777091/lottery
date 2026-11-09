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
