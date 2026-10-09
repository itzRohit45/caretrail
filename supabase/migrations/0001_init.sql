-- CareTrail: initial schema.
-- 9 patient-data tables from the PRD, 3 server-only support tables, 5 read-only reference tables,
-- RLS on every table, an insert-only audit log, and a private storage bucket.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Patient data
-- ---------------------------------------------------------------------------

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  dob date check (dob > date '1900-01-01'),
  sex text check (sex in ('female', 'male', 'other')),
  blood_group text check (blood_group in ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
  emergency_contact_name text check (char_length(emergency_contact_name) <= 120),
  emergency_contact_phone text check (emergency_contact_phone ~ '^\+?[0-9 ()-]{6,20}$'),
  emergency_contact_email text check (char_length(emergency_contact_email) <= 254),
  -- Tier 1 emergency card: only the SHA-256 of the token is stored; regenerating replaces it.
  emergency_token_hash text unique check (emergency_token_hash ~ '^[a-f0-9]{64}$'),
  emergency_token_created_at timestamptz,
  is_demo_template boolean not null default false,
  created_at timestamptz not null default now()
);
create index patients_owner_idx on public.patients (owner_user_id);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  type text not null check (type in ('prescription', 'lab_report', 'discharge_summary', 'scan_report', 'other')),
  doc_date date,
  -- 'upload' means no date was found and the patient has not set one: the UI shows a marker.
  doc_date_source text not null default 'upload' check (doc_date_source in ('extracted', 'patient', 'upload')),
  facility text,
  doctor_name text,
  file_hash text not null check (file_hash ~ '^[a-f0-9]{64}$'),
  storage_path text not null,
  mime_type text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png')),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 10485760),
  original_filename text check (char_length(original_filename) <= 255),
  upload_status text not null default 'pending' check (upload_status in ('pending', 'uploaded')),
  extraction_status text not null default 'pending'
    check (extraction_status in ('pending', 'processing', 'needs_review', 'completed', 'failed', 'skipped')),
  extraction jsonb,          -- Zod-validated model output, kept for the verify screen and audit
  extraction_error text,     -- short machine reason only, never medical content
  condition_tags text[] not null default '{}',  -- derived at verify time; drives condition-scoped sharing
  uploaded_by text not null default 'patient',
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (patient_id, file_hash)
);
create index documents_patient_created_idx on public.documents (patient_id, created_at desc);

create table public.medications (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  source_document_id uuid not null references public.documents (id) on delete cascade,
  brand_name text not null,
  generic_name text,                          -- display form, e.g. 'metformin + glimepiride'
  generics text[] not null default '{}',      -- normalised components used by the safety engine
  recognised boolean not null default false,  -- false = 'unrecognised', excluded from interaction checks
  dose text,
  frequency text,
  duration_days integer check (duration_days between 1 and 3650),
  prescriber text,
  start_date date,
  active boolean not null default true,
  stopped_on date,
  confidence numeric(3, 2) check (confidence between 0 and 1),
  source_text text not null,
  verified_by_patient boolean not null default false,
  created_at timestamptz not null default now()
);
create index medications_patient_active_idx on public.medications (patient_id, active);
create index medications_source_idx on public.medications (source_document_id);

create table public.lab_results (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  source_document_id uuid not null references public.documents (id) on delete cascade,
  test_name text not null,
  test_code text,              -- null when the test name is not recognised
  value numeric,
  value_text text,             -- exactly as written
  unit text,
  value_normalised numeric,
  unit_normalised text,
  ref_low numeric,
  ref_high numeric,
  ref_range_text text,
  test_date date not null,
  facility text,
  confidence numeric(3, 2) check (confidence between 0 and 1),
  source_text text not null,
  verified_by_patient boolean not null default false,
  created_at timestamptz not null default now()
  -- No uniqueness on (test_code, test_date): two labs on the same day are both kept.
);
create index lab_results_patient_test_idx on public.lab_results (patient_id, test_code, test_date);
create index lab_results_source_idx on public.lab_results (source_document_id);

create table public.conditions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  source_document_id uuid not null references public.documents (id) on delete cascade,
  name text not null,
  category text,               -- diabetes | hypertension | thyroid | asthma | cardiac | other
  diagnosed_on date,
  status text not null default 'active' check (status in ('active', 'resolved')),
  confidence numeric(3, 2) check (confidence between 0 and 1),
  source_text text not null,
  verified_by_patient boolean not null default false,
  created_at timestamptz not null default now()
);
create index conditions_patient_idx on public.conditions (patient_id);
create index conditions_source_idx on public.conditions (source_document_id);

create table public.allergies (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  substance text not null check (char_length(substance) between 1 and 80),
  severity text not null check (severity in ('mild', 'moderate', 'severe')),
  reaction text check (char_length(reaction) <= 200),
  created_at timestamptz not null default now()
);
create index allergies_patient_idx on public.allergies (patient_id);

create table public.share_links (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  label text check (char_length(label) <= 80),
  scope_type text not null check (scope_type in ('all', 'conditions', 'months')),
  scope_conditions text[] not null default '{}',
  scope_months integer check (scope_months in (3, 6, 12)),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  is_emergency boolean not null default false,
  is_break_glass boolean not null default false,
  allow_write_back boolean not null default false,
  require_otp boolean not null default false,
  otp_code text check (otp_code ~ '^[0-9]{6}$'),  -- readable by the owner only; never returned on token routes
  otp_failed_attempts integer not null default 0,
  created_at timestamptz not null default now(),
  check ((scope_type = 'conditions') = (cardinality(scope_conditions) > 0)),
  check ((scope_type = 'months') = (scope_months is not null)),
  check (require_otp = (otp_code is not null)),
  check (expires_at > created_at and expires_at <= created_at + interval '7 days 5 minutes')
);
create index share_links_patient_idx on public.share_links (patient_id, created_at desc);

-- Append-only audit trail. No foreign keys on purpose: deleting a document or a patient
-- never removes or blocks audit rows.
create table public.access_logs (
  id bigint generated always as identity primary key,
  patient_id uuid not null,
  share_link_id uuid,          -- null for emergency card scans
  viewer_name text check (char_length(viewer_name) <= 120),
  viewer_reg_no text check (char_length(viewer_reg_no) <= 60),
  viewer_hospital text check (char_length(viewer_hospital) <= 120),
  action text not null check (action in (
    'opened', 'viewed_document', 'added_note', 'emergency_scan', 'break_glass',
    'denied_out_of_scope', 'otp_failed'
  )),
  target_id uuid,
  ip_hash text check (ip_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now()
);
create index access_logs_patient_idx on public.access_logs (patient_id, created_at desc);
create index access_logs_link_idx on public.access_logs (share_link_id, created_at desc);

create table public.doctor_notes (
  id uuid primary key default gen_random_uuid(),
  share_link_id uuid not null references public.share_links (id) on delete cascade,
  patient_id uuid not null references public.patients (id) on delete cascade,
  doctor_name text not null check (char_length(doctor_name) between 1 and 120),
  note text not null check (char_length(note) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index doctor_notes_patient_idx on public.doctor_notes (patient_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Server-only support tables (RLS on, no client policies)
-- ---------------------------------------------------------------------------

-- Live "Dr. X is viewing now": one row per opened doctor session, touched by the 5 s heartbeat.
create table public.viewer_sessions (
  id uuid primary key default gen_random_uuid(),
  share_link_id uuid not null references public.share_links (id) on delete cascade,
  patient_id uuid not null references public.patients (id) on delete cascade,
  viewer_name text not null check (char_length(viewer_name) between 1 and 120),
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index viewer_sessions_patient_idx on public.viewer_sessions (patient_id, last_seen_at desc);

-- Same file is never sent to the model twice.
create table public.extraction_cache (
  file_hash text primary key check (file_hash ~ '^[a-f0-9]{64}$'),
  model text not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);

-- Fixed-window counters for token routes (30 requests per minute per IP).
create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  count integer not null default 1,
  primary key (key, window_start)
);

create function public.rate_limit_hit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  w timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  c integer;
begin
  insert into public.rate_limits (key, window_start, count) values (p_key, w, 1)
  on conflict (key, window_start) do update set count = public.rate_limits.count + 1
  returning count into c;
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '1 hour';
  end if;
  return c <= p_limit;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reference tables (seeded, read-only)
-- ---------------------------------------------------------------------------

create table public.generics (
  generic text primary key check (generic = lower(generic)),
  drug_class text,             -- e.g. 'penicillins'; used for allergy matching
  category text                -- diabetes | hypertension | thyroid | asthma | cardiac | other
);

create table public.brand_generic_map (
  brand text not null,
  generic text not null references public.generics (generic),
  strength text,
  primary key (brand, generic)  -- combination brands have one row per component
);

create table public.drug_interactions (
  generic_a text not null references public.generics (generic),
  generic_b text not null references public.generics (generic),
  severity text not null check (severity in ('major', 'moderate', 'minor')),
  note text,
  source text not null default 'DDInter',
  primary key (generic_a, generic_b),
  check (generic_a < generic_b)
);

create table public.test_validity (
  test_code text primary key,
  test_name text not null,
  validity_days integer not null check (validity_days > 0),
  typical_price_inr integer not null check (typical_price_inr >= 0)  -- hand-curated estimate
);

create table public.lab_reference_ranges (
  test_code text not null,
  unit text not null,
  low numeric,
  high numeric,
  primary key (test_code, unit)
);

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

create function public.owns_patient(pid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.patients p where p.id = pid and p.owner_user_id = (select auth.uid())
  );
$$;

alter table public.patients enable row level security;
create policy patients_select on public.patients for select to authenticated
  using (owner_user_id = (select auth.uid()));
create policy patients_insert on public.patients for insert to authenticated
  with check (owner_user_id = (select auth.uid()));
create policy patients_update on public.patients for update to authenticated
  using (owner_user_id = (select auth.uid())) with check (owner_user_id = (select auth.uid()));
-- The owner may edit profile fields only; token hashes and the demo flag are server-written.
revoke update on public.patients from authenticated;
grant update (name, dob, sex, blood_group, emergency_contact_name, emergency_contact_phone, emergency_contact_email)
  on public.patients to authenticated;

-- Owner has full CRUD on these, always scoped to their own patients.
do $$
declare t text;
begin
  foreach t in array array['documents', 'medications', 'lab_results', 'conditions', 'allergies'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.owns_patient(patient_id))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.owns_patient(patient_id))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.owns_patient(patient_id)) with check (public.owns_patient(patient_id))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.owns_patient(patient_id))', t || '_delete', t);
  end loop;
end;
$$;

-- Share links: owner creates, lists and revokes. Only revoked_at is updatable; never deletable.
alter table public.share_links enable row level security;
create policy share_links_select on public.share_links for select to authenticated using (public.owns_patient(patient_id));
create policy share_links_insert on public.share_links for insert to authenticated with check (public.owns_patient(patient_id));
create policy share_links_update on public.share_links for update to authenticated
  using (public.owns_patient(patient_id)) with check (public.owns_patient(patient_id));
revoke update, delete on public.share_links from authenticated;
grant update (revoked_at) on public.share_links to authenticated;

-- Revocation is final: once set, revoked_at can never be cleared or moved.
create function public.keep_revocation_final()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at then
    raise exception 'share link already revoked';
  end if;
  return new;
end;
$$;
create trigger share_links_revocation_final
  before update on public.share_links
  for each row execute function public.keep_revocation_final();

-- Read-only to the owner; written by token routes on the server.
alter table public.access_logs enable row level security;
create policy access_logs_select on public.access_logs for select to authenticated using (public.owns_patient(patient_id));
alter table public.doctor_notes enable row level security;
create policy doctor_notes_select on public.doctor_notes for select to authenticated using (public.owns_patient(patient_id));
alter table public.viewer_sessions enable row level security;
create policy viewer_sessions_select on public.viewer_sessions for select to authenticated using (public.owns_patient(patient_id));

-- Server only.
alter table public.extraction_cache enable row level security;
alter table public.rate_limits enable row level security;

-- Reference data: readable by everyone, writable by no client.
do $$
declare t text;
begin
  foreach t in array array['generics', 'brand_generic_map', 'drug_interactions', 'test_validity', 'lab_reference_ranges'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to anon, authenticated using (true)', t || '_read', t);
    execute format('revoke insert, update, delete, truncate on public.%I from anon, authenticated', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Insert-only audit log, enforced in the database for every role
-- ---------------------------------------------------------------------------

revoke update, delete, truncate on public.access_logs from anon, authenticated, service_role;
revoke insert on public.access_logs from anon, authenticated;

create function public.forbid_access_log_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'access_logs is append-only';
end;
$$;

create trigger access_logs_no_update_delete
  before update or delete on public.access_logs
  for each row execute function public.forbid_access_log_change();
create trigger access_logs_no_truncate
  before truncate on public.access_logs
  for each statement execute function public.forbid_access_log_change();

revoke execute on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- New user -> patient profile
-- ---------------------------------------------------------------------------

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Demo accounts get a cloned patient instead of an empty one.
  if coalesce((new.raw_user_meta_data ->> 'demo')::boolean, false) then
    return new;
  end if;
  insert into public.patients (owner_user_id, name)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), 'My profile'));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Private file storage: no client policies, so files are reachable only through
-- server-issued signed URLs (upload) and 5-minute signed URLs (download).
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Seed: test validity windows and charted reference ranges (hand-curated).
-- Prices are approximate typical Chennai lab prices and are labelled as estimates in the UI.
-- brand_generic_map, generics and drug_interactions are seeded in 0002 (curated brands + DDInter pairs).
-- ---------------------------------------------------------------------------

insert into public.test_validity (test_code, test_name, validity_days, typical_price_inr) values
  ('HBA1C', 'HbA1c', 90, 450),
  ('FBS', 'Fasting blood glucose', 30, 80),
  ('PPBS', 'Post-prandial blood glucose', 30, 80),
  ('LIPID', 'Lipid profile', 180, 600),
  ('KFT', 'Kidney function test', 180, 700),
  ('LFT', 'Liver function test', 180, 700),
  ('TFT', 'Thyroid profile (T3, T4, TSH)', 180, 550),
  ('TSH', 'TSH', 180, 300),
  ('CBC', 'Complete blood count', 90, 350),
  ('URINE_RE', 'Urine routine', 90, 150),
  ('UACR', 'Urine albumin creatinine ratio', 365, 600),
  ('ELECTROLYTES', 'Serum electrolytes', 90, 500),
  ('VITD', 'Vitamin D (25-OH)', 365, 1500),
  ('VITB12', 'Vitamin B12', 365, 1000),
  ('ECG', 'ECG', 365, 300),
  ('ECHO', 'Echocardiogram', 365, 2500),
  ('CXR', 'Chest X-ray', 365, 400),
  ('PFT', 'Pulmonary function test', 365, 1200),
  ('TROPONIN', 'Troponin', 1, 900),
  ('HB', 'Haemoglobin', 90, 100);

insert into public.lab_reference_ranges (test_code, unit, low, high) values
  ('HBA1C', '%', 4.0, 5.6),
  ('FBS', 'mg/dL', 70, 99),
  ('PPBS', 'mg/dL', 70, 139),
  ('BP_SYS', 'mmHg', 90, 119),
  ('BP_DIA', 'mmHg', 60, 79),
  ('TSH', 'mIU/L', 0.4, 4.0),
  ('LDL', 'mg/dL', 0, 99),
  ('HDL', 'mg/dL', 40, null),
  ('TC', 'mg/dL', 0, 199),
  ('TG', 'mg/dL', 0, 149),
  ('CREAT', 'mg/dL', 0.6, 1.2),
  ('FT4', 'ng/dL', 0.8, 1.8);
