-- AD NŪTUM v0.6 authority receipts and delegation schema

create extension if not exists pgcrypto;

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists environments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  slug text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  unique(project_id, slug)
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
  environment_id uuid references environments(id) on delete set null,
  agent_id uuid references agents(id) on delete set null,
  action text not null,
  payload jsonb not null,
  decision text not null check (decision in ('allow','deny','approval_required')),
  policy_id text not null,
  reason text not null,
  required_approver text,
  created_at timestamptz not null default now()
);

alter table authorization_requests
  add column if not exists environment_id uuid references environments(id) on delete set null;

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

create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  environment_id uuid not null references environments(id) on delete cascade,
  name text not null,
  key_prefix text not null,
  key_hash text not null unique,
  last4 text not null,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);


create table if not exists authority_receipts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  authorization_request_id uuid references authorization_requests(id) on delete set null,
  parent_receipt_id uuid references authority_receipts(id) on delete set null,
  agent_id uuid not null references agents(id) on delete cascade,
  environment_id uuid references environments(id) on delete set null,
  action text not null,
  scope jsonb not null default '{}'::jsonb,
  issued_by text not null,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoked_by text,
  revocation_reason text,
  check (expires_at > issued_at)
);

create unique index if not exists authority_receipts_request_unique_idx
  on authority_receipts(authorization_request_id)
  where authorization_request_id is not null;

create index if not exists authority_receipts_project_created_idx
  on authority_receipts(project_id, issued_at desc);

create index if not exists authority_receipts_parent_idx
  on authority_receipts(parent_receipt_id);

create index if not exists authorization_requests_project_created_idx
  on authorization_requests(project_id, created_at desc);

create index if not exists authorization_requests_environment_created_idx
  on authorization_requests(environment_id, created_at desc);

create index if not exists audit_events_project_created_idx
  on audit_events(project_id, created_at desc);

create index if not exists policies_project_action_idx
  on policies(project_id, action, is_active);

create index if not exists api_keys_project_created_idx
  on api_keys(project_id, created_at desc);

alter table projects enable row level security;
alter table environments enable row level security;
alter table agents enable row level security;
alter table policies enable row level security;
alter table authorization_requests enable row level security;
alter table approval_decisions enable row level security;
alter table audit_events enable row level security;
alter table api_keys enable row level security;
alter table authority_receipts enable row level security;

-- v0.6 intentionally defines no public RLS policies.
-- The Cloudflare Worker uses the Supabase secret key server-side.
-- Raw developer API keys are never stored. Only SHA-256 hashes are persisted.
