-- Proposed migration only; NOT applied or wired to the local SQLite application.
-- Requires Supabase Auth. Clinical access is API-mediated and denied to browsers.
-- Evaluate on a disposable project and add policy tests before any deployment.
begin;

create table public.cw_institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null check (kind in ('provider', 'payer'))
);

create table public.cw_memberships (
  user_id uuid not null references auth.users(id),
  institution_id uuid not null references public.cw_institutions(id),
  role text not null check (role in ('doctor', 'staff', 'payer_reviewer', 'admin')),
  active boolean not null default true,
  primary key (user_id, institution_id)
);

create table public.cw_patients (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table public.cw_patient_links (
  patient_id uuid not null references public.cw_patients(id),
  institution_id uuid not null references public.cw_institutions(id),
  local_identifier text not null,
  status text not null check (status in ('pending', 'confirmed', 'rejected')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  primary key (institution_id, local_identifier),
  check (status <> 'confirmed' or (reviewed_by is not null and reviewed_at is not null))
);

create table public.cw_consent_grants (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.cw_patients(id),
  recipient_id uuid not null references public.cw_institutions(id),
  purpose text not null check (purpose in ('care', 'claim_review')),
  categories text[] not null,
  record_ids uuid[],
  valid_from timestamptz not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  evidence_reference text not null,
  created_at timestamptz not null default now(),
  check (expires_at > valid_from),
  check (cardinality(categories) > 0)
);

create table public.cw_records (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.cw_patients(id),
  institution_id uuid not null references public.cw_institutions(id),
  source_identifier text not null,
  source_version text not null,
  category text not null,
  clinical_at timestamptz,
  retrieved_at timestamptz not null default now(),
  original jsonb not null,
  fhir jsonb not null check (fhir ? 'resourceType'),
  validation_status text not null check (validation_status in ('pending', 'accepted', 'rejected')),
  unique (institution_id, source_identifier, source_version)
);

create table public.cw_evidence_edges (
  id uuid primary key default gen_random_uuid(),
  from_record uuid not null references public.cw_records(id),
  to_record uuid not null references public.cw_records(id),
  relation text not null check (relation in ('contradicts', 'supersedes', 'same_test', 'references')),
  reviewed_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  check (from_record <> to_record)
);

create table public.cw_summaries (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.cw_patients(id),
  institution_id uuid not null references public.cw_institutions(id),
  purpose text not null check (purpose in ('care', 'claim_review')),
  content jsonb not null,
  source_versions jsonb not null,
  status text not null check (status in ('draft', 'approved', 'stale')),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  check (status <> 'approved' or (approved_by is not null and approved_at is not null))
);

create table public.cw_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  institution_id uuid references public.cw_institutions(id),
  patient_id uuid references public.cw_patients(id),
  action text not null,
  outcome text not null check (outcome in ('allowed', 'denied', 'error')),
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index cw_records_patient_idx on public.cw_records(patient_id, institution_id, category);
create index cw_consent_scope_idx on public.cw_consent_grants(patient_id, recipient_id, purpose, expires_at);
create index cw_audit_patient_idx on public.cw_audit_events(patient_id, occurred_at);

alter table public.cw_institutions enable row level security;
alter table public.cw_memberships enable row level security;
alter table public.cw_patients enable row level security;
alter table public.cw_patient_links enable row level security;
alter table public.cw_consent_grants enable row level security;
alter table public.cw_records enable row level security;
alter table public.cw_evidence_edges enable row level security;
alter table public.cw_summaries enable row level security;
alter table public.cw_audit_events enable row level security;

revoke all on public.cw_institutions, public.cw_memberships, public.cw_patients,
  public.cw_patient_links, public.cw_consent_grants, public.cw_records,
  public.cw_evidence_edges, public.cw_summaries, public.cw_audit_events from anon, authenticated;

-- A signed-in user can inspect only their own membership; they cannot grant it.
grant select on public.cw_memberships to authenticated;
create policy cw_self_membership_read on public.cw_memberships
  for select to authenticated using (user_id = (select auth.uid()));

-- No browser SELECT/INSERT/UPDATE/DELETE grants or permissive policies on clinical
-- tables. A future backend validates JWT, active membership and current purpose-
-- scoped consent before each service-role query (service_role bypasses RLS).
-- Do not grant browser reads to records based on institution membership alone:
-- that would omit patient consent and the care-vs-claim purpose boundary.
grant all on public.cw_institutions, public.cw_memberships, public.cw_patients,
  public.cw_patient_links, public.cw_consent_grants, public.cw_records,
  public.cw_evidence_edges, public.cw_summaries, public.cw_audit_events to service_role;

commit;
