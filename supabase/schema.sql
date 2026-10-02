-- AD NŪTUM v0.2 durable schema

create extension if not exists pgcrypto;

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists agents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  external_key text not null,
  name text not null,
  created_at timestamptz not null default now(),
  unique(project_id, external_key)
);

create table if not exists policies (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  action text not null,
  rule jsonb not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists authorization_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  agent_id uuid references agents(id) on delete set null,
  action text not null,
  payload jsonb not null,
  decision text not null check (decision in ('allow','deny','approval_required')),
  policy_id text not null,
  reason text not null,
  required_approver text,
  created_at timestamptz not null default now()
);

create table if not exists approval_decisions (
  id uuid primary key default gen_random_uuid(),
  authorization_request_id uuid not null references authorization_requests(id) on delete cascade,
  decided_by text not null,
  decision text not null check (decision in ('approved','rejected')),
  note text,
  created_at timestamptz not null default now()
);

create table if not exists audit_events (
  id bigint generated always as identity primary key,
  project_id uuid not null references projects(id) on delete cascade,
  authorization_request_id uuid references authorization_requests(id) on delete set null,
  event_type text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists authorization_requests_project_created_idx
  on authorization_requests(project_id, created_at desc);

create index if not exists audit_events_project_created_idx
  on audit_events(project_id, created_at desc);

alter table projects enable row level security;
alter table agents enable row level security;
alter table policies enable row level security;
alter table authorization_requests enable row level security;
alter table approval_decisions enable row level security;
alter table audit_events enable row level security;

-- v0.2 intentionally defines no public RLS policies.
-- The Cloudflare Worker uses the Supabase service-role key server-side.
