-- Run this in your Supabase project:
-- Dashboard → SQL Editor → New Query → paste & run

-- Users table
create table if not exists public.users (
  id                uuid primary key default gen_random_uuid(),
  email             text not null unique,
  credits_remaining integer not null default 3,
  created_at        timestamptz not null default now()
);

-- Index for fast email lookups
create index if not exists users_email_idx on public.users (email);

-- Row Level Security: only your service key can access this table
alter table public.users enable row level security;

-- No public access — all reads/writes go through your Netlify functions
-- using the SUPABASE_SERVICE_KEY which bypasses RLS
create policy "No public access" on public.users
  for all using (false);
