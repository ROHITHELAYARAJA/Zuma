create table if not exists public.hospitals (
  id text primary key check (id in ('A','B')),
  name text not null,
  city text,
  contact_email text,
  created_at timestamptz not null default now()
);

create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  patient_code text unique not null,
  full_name text not null,
  birth_date date not null,
  sex text not null check (sex in ('male','female','other','unknown')),
  phone text,
  created_at timestamptz not null default now()
);

create table if not exists public.hospital_patients (
  hospital_id text not null references public.hospitals(id),
  local_patient_id text not null,
  patient_id uuid references public.patients(id),
  full_name text not null,
  birth_date date not null,
  sex text not null check (sex in ('male','female','other','unknown')),
  match_status text not null default 'pending' check (match_status in ('pending','confirmed','rejected')),
  confirmed_by uuid references auth.users(id),
  confirmed_at timestamptz,
  primary key (hospital_id,local_patient_id),
  check (match_status <> 'confirmed' or (patient_id is not null and confirmed_by is not null and confirmed_at is not null))
);

create table if not exists public.doctors (
  id uuid primary key default gen_random_uuid(),
  doctor_code text unique not null,
  auth_user_id uuid unique references auth.users(id),
  hospital_id text not null references public.hospitals(id),
  full_name text not null,
  email text not null,
  specialty text,
  registration_number text,
  active boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.medical_reports (
  id uuid primary key default gen_random_uuid(),
  report_code text not null,
  hospital_id text not null,
  local_patient_id text not null,
  doctor_id uuid references public.doctors(id),
  category text not null check (category in ('lab','allergy','medication','note')),
  title text not null,
  clinical_at timestamptz not null,
  received_at timestamptz not null default now(),
  file_name text,
  mime_type text,
  s3_bucket text,
  s3_key text,
  sha256 text check (sha256 is null or sha256 ~ '^[a-f0-9]{64}$'),
  native_payload jsonb,
  fhir_resource jsonb,
  mapping_status text not null default 'pending' check (mapping_status in ('pending','mapped','review_required','rejected')),
  version integer not null default 1 check (version > 0),
  foreign key (hospital_id,local_patient_id) references public.hospital_patients(hospital_id,local_patient_id),
  unique (hospital_id,report_code,version)
);

create table if not exists public.patient_consents (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id),
  source_hospital_id text not null references public.hospitals(id),
  recipient_hospital_id text not null references public.hospitals(id),
  recipient_doctor_id uuid references public.doctors(id),
  purpose text not null check (purpose in ('treatment','claim')),
  categories text[] not null check (cardinality(categories)>0 and categories <@ array['lab','allergy','medication','note']::text[]),
  status text not null default 'pending' check (status in ('pending','active','revoked','expired')),
  granted_at timestamptz,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  version integer not null default 1 check (version>0),
  created_at timestamptz not null default now(),
  check (granted_at is null or expires_at>granted_at)
);

create table if not exists public.clinical_summaries (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id),
  doctor_id uuid not null references public.doctors(id),
  consent_id uuid references public.patient_consents(id),
  source_report_ids uuid[] not null default '{}',
  source_version text not null,
  summary_text text not null,
  fhir_bundle jsonb,
  status text not null default 'draft' check (status in ('draft','approved','invalidated')),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  check (status <> 'approved' or approved_at is not null)
);

create table if not exists public.clinical_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id),
  patient_id uuid references public.patients(id),
  hospital_id text references public.hospitals(id),
  action text not null,
  outcome text not null check (outcome in ('allowed','denied','recorded')),
  request_id uuid,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists hospital_patients_patient_idx on public.hospital_patients(patient_id);
create index if not exists medical_reports_patient_idx on public.medical_reports(hospital_id,local_patient_id,clinical_at);
create index if not exists patient_consents_patient_idx on public.patient_consents(patient_id,status);
create index if not exists clinical_summaries_patient_idx on public.clinical_summaries(patient_id);
create index if not exists clinical_audit_patient_idx on public.clinical_audit_events(patient_id,created_at);

insert into public.hospitals(id,name) values ('A','Aster General'),('B','Meridian Medical') on conflict (id) do nothing;

alter table public.hospitals enable row level security;
alter table public.patients enable row level security;
alter table public.hospital_patients enable row level security;
alter table public.doctors enable row level security;
alter table public.medical_reports enable row level security;
alter table public.patient_consents enable row level security;
alter table public.clinical_summaries enable row level security;
alter table public.clinical_audit_events enable row level security;
revoke all on public.hospitals,public.patients,public.hospital_patients,public.doctors,public.medical_reports,public.patient_consents,public.clinical_summaries,public.clinical_audit_events from anon,authenticated;
grant select,insert,update,delete on public.hospitals,public.patients,public.hospital_patients,public.doctors,public.medical_reports,public.patient_consents,public.clinical_summaries to service_role;
revoke all on public.clinical_audit_events from service_role;
grant select,insert on public.clinical_audit_events to service_role;
