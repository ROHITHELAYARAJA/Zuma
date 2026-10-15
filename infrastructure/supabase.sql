create table if not exists public.clinician_memberships (
  user_id uuid not null references auth.users(id) on delete cascade,
  hospital_id text not null check (hospital_id in ('A', 'B')),
  role text not null check (role in ('doctor', 'payer')),
  active boolean not null default false,
  display_name text not null default 'Authorized clinician',
  created_at timestamptz not null default now(),
  primary key (user_id, hospital_id)
);

create table if not exists public.clinical_state_sessions (
  id text primary key check (id ~ '^[a-f0-9]{64}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  expires_at timestamptz not null,
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clinical_state_sessions_user_idx on public.clinical_state_sessions (user_id);
create index if not exists clinical_state_sessions_expiry_idx on public.clinical_state_sessions (expires_at);
alter table public.clinician_memberships enable row level security;
alter table public.clinical_state_sessions enable row level security;
revoke all on public.clinician_memberships from anon, authenticated;
revoke all on public.clinical_state_sessions from anon, authenticated;
grant select, insert, update, delete on public.clinician_memberships to service_role;
grant select, insert, update, delete on public.clinical_state_sessions to service_role;
