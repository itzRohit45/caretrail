-- "Try demo": each visitor gets a private copy of a seeded demo patient, so judges never
-- interfere with each other. Facts keep their source links; files are shared read-only.

create function public.clone_demo_patient(p_template uuid, p_owner uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_patient uuid := gen_random_uuid();
begin
  insert into public.patients (id, owner_user_id, name, dob, sex, blood_group, emergency_contact_name, emergency_contact_phone, emergency_contact_email)
  select new_patient, p_owner, name, dob, sex, blood_group, emergency_contact_name, emergency_contact_phone, emergency_contact_email
  from public.patients where id = p_template and is_demo_template;
  if not found then
    raise exception 'not a demo template';
  end if;

  insert into public.allergies (patient_id, substance, severity, reaction, created_at)
  select new_patient, substance, severity, reaction, created_at from public.allergies where patient_id = p_template;

  create temp table _doc_map (old_id uuid primary key, new_id uuid not null) on commit drop;
  insert into _doc_map select id, gen_random_uuid() from public.documents where patient_id = p_template;

  insert into public.documents (id, patient_id, type, doc_date, doc_date_source, facility, doctor_name, file_hash, storage_path,
    mime_type, size_bytes, original_filename, upload_status, extraction_status, extraction, extraction_error, condition_tags,
    uploaded_by, verified_at, created_at)
  select m.new_id, new_patient, d.type, d.doc_date, d.doc_date_source, d.facility, d.doctor_name, d.file_hash, d.storage_path,
    d.mime_type, d.size_bytes, d.original_filename, d.upload_status, d.extraction_status, d.extraction, d.extraction_error,
    d.condition_tags, d.uploaded_by, d.verified_at, d.created_at
  from public.documents d join _doc_map m on m.old_id = d.id;

  insert into public.medications (patient_id, source_document_id, brand_name, generic_name, generics, recognised, dose, frequency,
    duration_days, prescriber, start_date, active, stopped_on, confidence, source_text, verified_by_patient, created_at)
  select new_patient, m.new_id, x.brand_name, x.generic_name, x.generics, x.recognised, x.dose, x.frequency,
    x.duration_days, x.prescriber, x.start_date, x.active, x.stopped_on, x.confidence, x.source_text, x.verified_by_patient, x.created_at
  from public.medications x join _doc_map m on m.old_id = x.source_document_id;

  insert into public.lab_results (patient_id, source_document_id, test_name, test_code, value, value_text, unit, value_normalised,
    unit_normalised, ref_low, ref_high, ref_range_text, test_date, facility, confidence, source_text, verified_by_patient, created_at)
  select new_patient, m.new_id, x.test_name, x.test_code, x.value, x.value_text, x.unit, x.value_normalised,
    x.unit_normalised, x.ref_low, x.ref_high, x.ref_range_text, x.test_date, x.facility, x.confidence, x.source_text, x.verified_by_patient, x.created_at
  from public.lab_results x join _doc_map m on m.old_id = x.source_document_id;

  insert into public.conditions (patient_id, source_document_id, name, category, diagnosed_on, status, confidence, source_text, verified_by_patient, created_at)
  select new_patient, m.new_id, x.name, x.category, x.diagnosed_on, x.status, x.confidence, x.source_text, x.verified_by_patient, x.created_at
  from public.conditions x join _doc_map m on m.old_id = x.source_document_id;

  return new_patient;
end;
$$;

revoke execute on function public.clone_demo_patient(uuid, uuid) from public, anon, authenticated;
grant execute on function public.clone_demo_patient(uuid, uuid) to service_role;
